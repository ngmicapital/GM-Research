#!/usr/bin/env python3
"""
Content Scout — Channel Scanner (Lean Edition)

Scans YouTube RSS feeds for new uploads within a lookback window.
Deduplicates against a seen-log to avoid surfacing the same video twice.
Outputs JSON grouped by category.

Usage:
    python scan_channels.py --days 1
    python scan_channels.py --days 3 --category "AI / Tech"
    python scan_channels.py --no-dedup   # skip dedup for first run
"""

import argparse
import json
import sys
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

try:
    import feedparser
except ImportError:
    os.system("pip install feedparser --break-system-packages -q 2>/dev/null")
    import feedparser

try:
    import requests
except ImportError:
    os.system("pip install requests --break-system-packages -q 2>/dev/null")
    import requests

import re

# ─── Channel Database ─────────────────────────────────────────────────────────
# All channels with verified YouTube channel IDs.
# Channels without YT IDs are marked for web_search fallback by Claude.

CHANNELS = {
    "Fitness / Training / Health": [
        {"name": "Jeremy Ethier", "yt_id": "UCERm5yFZ1SptUEU4wZ2vJvw"},
        {"name": "Huberman Lab", "yt_id": "UC2D2CMWXMOVWx7giW1n3LIg"},
        {"name": "Barbell Medicine", "yt_id": "UCLeg0dR-VkabZH8CYr4RCxQ"},
        {"name": "Squat University", "yt_id": "UCyPYMFGGct1gqPMIh_RzIdg"},
        {"name": "Alan Thrall", "yt_id": "UCRLOLGZl3-QTaJfLmAKPo1w"},
        {"name": "Jeff Nippard", "yt_id": "UC68TLK0mAEzUyHx5x5k-S1Q"},
        {"name": "Renaissance Periodization", "yt_id": "UCfQgsKhHjSyRLOp9mnffqVg"},
        {"name": "Dr. Andy Galpin", "yt_id": "UCWEXrc71LyDf2W95PLa24jw"},
        {"name": "Bryan Johnson", "yt_id": "UCnRVL1-HJnXWB_Xi2dAoTcg"},
        {"name": "Noel Deyzel", "yt_id": "UCaalrecBwGBFAG8eIGODdLQ"},
        {"name": "Stronger by Science", "yt_id": "UC_9SjsqyO87d4aZkEqNuHBA"},
        {"name": "Peter Attia (The Drive)", "yt_id": "UC8kGsMa0LygSX9nkBcBH1Sg"},
        {"name": "Athlean-X", "yt_id": "UCAR76PvwLHcHqnbqFIos_Xg"},
    ],
    "Food / Cooking": [
        {"name": "J. Kenji López-Alt", "yt_id": "UCqqJQ_cXSat0KIAVfIfKkVA"},
        {"name": "Ethan Chlebowski", "yt_id": "UCDq5v10l4wkV5-ZBIJJFbzQ"},
        {"name": "Adam Ragusea", "yt_id": "UC9_p50tH3WmMslWRWKnM7dQ"},
        {"name": "Chinese Cooking Demystified", "yt_id": "UCg0m_Ah8P_MQbnn77-vYnYw"},
        {"name": "America's Test Kitchen", "yt_id": "UCh8m0PvZk3CUiQhakN_JTOw"},
        {"name": "Joshua Weissman", "yt_id": "UCUAg71CJEvFdOnujmep1Svw"},
    ],
    "Crypto / Web3 / DeFi": [
        {"name": "1000x Podcast", "yt_id": "UCkrwgzhIBKccuDsi_SvZtnQ"},
        {"name": "0xSteadyLads", "yt_id": "UC5K-A8n6phru-uNF6TzH5vQ"},
        {"name": "When Shift Happens", "yt_id": "UCIJbH32lGRhOkBwQeW-cSTg"},
        {"name": "a16z crypto", "yt_id": "UCjBboBhiiRkNrL6ld2QZVzQ"},
        {"name": "The Block", "yt_id": None, "search_name": "The Block crypto youtube"},
        {"name": "Unchained (Laura Shin)", "yt_id": None, "search_name": "Unchained Laura Shin podcast"},
        {"name": "Bell Curve", "yt_id": "UC9aOLLMQht_1FKRxbQe60NA"},
    ],
    "AI / Tech": [
        {"name": "AI Explained", "yt_id": "UCnAYEON3dDXz3RcIigBaQFg"},
        {"name": "Dwarkesh Patel", "yt_id": "UCuShTtbZ8mhUj8KZbXkZSCA"},
        {"name": "No Priors", "yt_id": None, "search_name": "No Priors AI podcast"},
        {"name": "Latent Space", "yt_id": "UCvi5jNRoRVm436TVAXet1kQ"},
        {"name": "Nick Saraev", "yt_id": "UCddiUEpeqJcYeBxX1IVBKvQ"},
        {"name": "Chris Messina", "yt_id": "UCAUAgXdzoEkgBs6NRg-T5oQ"},
        {"name": "Fireship", "yt_id": "UCsBjURrPoezykLs9EqgamOA"},
        {"name": "Matthew Berman", "yt_id": "UCsMica-v34Irf9KVTh6xx-g"},
        {"name": "TheAIGRID", "yt_id": "UCkw4JCwteGrDHIsyIIKo4tQ"},
        {"name": "Two Minute Papers", "yt_id": "UCbfYPyITQ-7l4upoX8nvctg"},
    ],
    "AI Governance / Tech Law": [
        {"name": "Stanford HAI", "yt_id": "UCnhGXDqoHkRbKHIHGCMDk1A"},
        {"name": "Brookings Institution", "yt_id": "UC9Lk1UMBhSVAyEJWZCO_8DA"},
        {"name": "Lawfare", "yt_id": None, "search_name": "Lawfare podcast"},
        {"name": "CSIS", "yt_id": "UCr5jq6MC_VCe1c5ciIZtk_w"},
    ],
    "Business / Startups / Product": [
        {"name": "Modern MBA", "yt_id": "UCklfRIEDSXHPfOqlmEbFeeg"},
        {"name": "Peter Yang", "yt_id": "UCnpBg7yqNauHtlNSpOl5-cg"},
        {"name": "Y Combinator", "yt_id": "UCcefcZRL2oaA_uBNeo5UOWg"},
        {"name": "Acquired FM", "yt_id": "UCyFqFYfTW2VoIQKylJ04Rtw"},
        {"name": "Lenny's Podcast", "yt_id": "UC6t1O76G0jYXOAoYCm153dA"},
        {"name": "a16z", "yt_id": "UCTOsYJz-clK4gliToC3OVhQ"},
        {"name": "Business Insider", "yt_id": "UCcyq283he07B7_KUX07mmtA"},
        {"name": "Colin and Samir", "yt_id": "UCamLi-jJpIYBO3rEvpNAVlA"},
        {"name": "My First Million", "yt_id": "UCxoRKax_0vHaulMbceZtAwA"},
    ],
    "Big Picture / Long-form": [
        {"name": "Lex Fridman", "yt_id": "UCSHZKyawb77ixDdsGog4iWA"},
        {"name": "All-In Podcast", "yt_id": "UCESLZhusAkFfsNsApnjF_Cg"},
        {"name": "High Performance Podcast", "yt_id": "UCQaB00JA0TT9vKqMOK3QYIA"},
        {"name": "Words of Rizdom", "yt_id": "UC2GyeAMRDA4cRIiISejML2g"},
        {"name": "The MIT Monk", "yt_id": "UC4ZVkG3RQPzvZk7alIVjcCg"},
        {"name": "Kurzgesagt", "yt_id": "UCsXVk37bltHxD1rDPwtNM8Q"},
        {"name": "Tim Ferriss", "yt_id": "UCznv7Vf9nBdJYvBagFdAHWw"},
    ],
    "F1": [
        {"name": "Formula 1 (official)", "yt_id": "UCB_qr75-ydFVKSz9nCqgPfg"},
        {"name": "Formula Insights", "yt_id": "UCGpCXXuMbeXo3wmhr2MBYGw"},
        {"name": "Mr Pulse F1", "yt_id": "UCauNp5GZDhM6scOrtQOpXiA"},
        {"name": "Chain Bear", "yt_id": "UCcIqViUAuEjFwBbSIAB0NMA"},
        {"name": "The Race", "yt_id": "UCMrJFKP0r0FJ-TWe_-NFLOQ"},
    ],
    "MMA / Combat Sports": [
        {"name": "Official Fight Lab", "yt_id": "UCPqk6TzLQt-7GSgmbGIe__g"},
        {"name": "The MMA Analysis", "yt_id": "UCRunxh0l8QmuS5jxs7d7vxw"},
        {"name": "Victor MMA", "yt_id": "UC7Kbb1kgetLX11Mnbf1lmnQ"},
        {"name": "Jack Slack", "yt_id": "UC2i7H-EzzpQLeaj3Qplatjw"},
        {"name": "Luke Thomas", "yt_id": "UClgZbt_pgKMElTI1sl2JOCg"},
    ],
    "Cars": [
        {"name": "Throttle House", "yt_id": "UCBBKME5mloAOwuECrg_BKIA"},
        {"name": "Doug DeMuro", "yt_id": "UCsqjHFMB_JYTaEnf_vmTNqg"},
        {"name": "Hagerty", "yt_id": "UCik2k1L7hGaQGU6WY2F8oVg"},
    ],
    "Electronic Music / DJing": [
        {"name": "Resident Advisor", "yt_id": None, "search_name": "Resident Advisor RA Exchange podcast"},
        {"name": "Decoded Magazine", "yt_id": None, "search_name": "Decoded Magazine podcast"},
        {"name": "EQ50", "yt_id": None, "search_name": "EQ50 podcast DJ"},
    ],
    "Philosophy / Stoicism": [
        {"name": "The Daily Stoic", "yt_id": "UCkUaT0T03TJvafYkfATM2Ag"},
        {"name": "Philosophize This!", "yt_id": None, "search_name": "Philosophize This Stephen West podcast"},
        {"name": "The Knowledge Project", "yt_id": None, "search_name": "Knowledge Project Shane Parrish podcast"},
        {"name": "Philosophy Tube", "yt_id": "UC2PA-AKmVpU6NKCGtZq_rKQ"},
    ],
    "Travel / Culture": [
        {"name": "Monocle 24: The Globalist", "yt_id": None, "search_name": "Monocle 24 Globalist podcast"},
        {"name": "Cabin Pressure (Monocle)", "yt_id": None, "search_name": "Cabin Pressure Monocle podcast"},
    ],
    "Poker Strategy": [
        {"name": "Thinking Poker", "yt_id": None, "search_name": "Thinking Poker Podcast"},
        {"name": "The Poker Guys", "yt_id": "UCyI3Fk8Dbz_M5E5LIOkPwiQ"},
        {"name": "Jonathan Little", "yt_id": "UCMoIoXQCpkvEaLRcIIAoxGg"},
        {"name": "Doug Polk", "yt_id": "UCyI2-QB4MNa-ONJBPjmA66g"},
        {"name": "Bart Hanson", "yt_id": "UC5bl6z-JjGHnKMVfNw-0E6Q"},
        {"name": "Chasing Poker Greatness", "yt_id": None, "search_name": "Chasing Poker Greatness podcast"},
    ],
    "Psychedelics / Substance Research": [
        {"name": "MAPS", "yt_id": "UCxUB5VMPq--VgjOmSxz1qIg"},
        {"name": "Hamilton Morris", "yt_id": "UCGlVsq-AUeSQ1CgOx2XvIRQ"},
        {"name": "The Drug Classroom", "yt_id": "UCOfMbsNxPmSS6X21EwtSRDA"},
        {"name": "PsychedSubstance", "yt_id": "UCn8V3KNUGsLmN-u_g5KxzUg"},
        {"name": "Adventures Through the Mind", "yt_id": None, "search_name": "Adventures Through the Mind James Jesso"},
        {"name": "Psychedelics Today", "yt_id": "UCLAsaaOjYmqACvq6P_0hZ6w"},
    ],
}

CATEGORY_EMOJIS = {
    "Fitness / Training / Health": "\U0001f4aa",
    "Food / Cooking": "\U0001f373",
    "Crypto / Web3 / DeFi": "\U0001fa99",
    "AI / Tech": "\U0001f916",
    "AI Governance / Tech Law": "\u2696\ufe0f",
    "Business / Startups / Product": "\U0001f680",
    "Big Picture / Long-form": "\U0001f399\ufe0f",
    "F1": "\U0001f3ce\ufe0f",
    "MMA / Combat Sports": "\U0001f94a",
    "Cars": "\U0001f697",
    "Electronic Music / DJing": "\U0001f3a7",
    "Philosophy / Stoicism": "\U0001f9e0",
    "Travel / Culture": "\u2708\ufe0f",
    "Poker Strategy": "\u2660\ufe0f",
    "Psychedelics / Substance Research": "\U0001f52c",
}


# ─── Seen Log (dedup) & Transcript Log ────────────────────────────────────────

SEEN_LOG_PATH = Path(__file__).parent.parent / "seen_log.json"
TRANSCRIPT_LOG_PATH = Path(__file__).parent.parent / "transcript_log.json"


def load_seen_log():
    if SEEN_LOG_PATH.exists():
        try:
            return json.loads(SEEN_LOG_PATH.read_text())
        except:
            return {}
    return {}


def save_seen_log(log):
    # Keep only last 30 days of entries to prevent bloat
    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    trimmed = {k: v for k, v in log.items() if v.get("first_seen", "") > cutoff}
    SEEN_LOG_PATH.write_text(json.dumps(trimmed, indent=1))


def log_transcript_request(video_id, channel, category):
    """Append a transcript request to the transcript log."""
    try:
        log = []
        if TRANSCRIPT_LOG_PATH.exists():
            try:
                log = json.loads(TRANSCRIPT_LOG_PATH.read_text())
            except:
                pass

        log.append({
            "video_id": video_id,
            "channel": channel,
            "category": category,
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        })

        TRANSCRIPT_LOG_PATH.write_text(json.dumps(log, indent=1))
    except:
        pass


def get_preferred_channels():
    """Read transcript_log and return a dict of channel names to request counts."""
    channels = {}
    if TRANSCRIPT_LOG_PATH.exists():
        try:
            log = json.loads(TRANSCRIPT_LOG_PATH.read_text())
            for entry in log:
                channel = entry.get("channel", "")
                if channel:
                    channels[channel] = channels.get(channel, 0) + 1
        except:
            pass
    return channels


# ─── Short-form Detection ─────────────────────────────────────────────────────

# Minimum duration in seconds to be considered "long-form" (worth a transcript).
# Anything under this is classified as a short. 5 minutes = 300 seconds.
MIN_LONG_FORM_SECONDS = 300

SHORT_FORM_TITLE_SIGNALS = ["#shorts", "#short", "#tiktok"]


def get_video_duration(video_id):
    """Get video duration in seconds from YouTube page metadata."""
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
        r = requests.get(url, headers=headers, timeout=8)
        match = re.search(r'"lengthSeconds":"(\d+)"', r.text)
        if match:
            return int(match.group(1))
        match = re.search(r'"approxDurationMs":"(\d+)"', r.text)
        if match:
            return int(match.group(1)) // 1000
    except:
        pass
    return None


def is_short_form(video_id, title, description=""):
    """Check if a video is short-form. Uses duration as primary signal,
    falls back to title heuristics if duration can't be fetched."""
    # Title signals are a quick first check
    text = (title + " " + description).lower()
    for signal in SHORT_FORM_TITLE_SIGNALS:
        if signal in text:
            return True, 0

    # Duration is the definitive check
    duration = get_video_duration(video_id)
    if duration is not None:
        return duration < MIN_LONG_FORM_SECONDS, duration

    # Can't determine — assume long-form to avoid missing content
    return False, None


# ─── YouTube RSS Scanner ──────────────────────────────────────────────────────

def _check_duration_for_entry(args):
    """Helper function for concurrent duration checking. Returns (video_id, is_short, duration)."""
    video_id, title, description = args
    # Check title signals first (no HTTP needed)
    text = (title + " " + description).lower()
    for signal in SHORT_FORM_TITLE_SIGNALS:
        if signal in text:
            return video_id, True, 0

    # Get duration if not already disqualified
    duration = get_video_duration(video_id)
    if duration is not None:
        return video_id, duration < MIN_LONG_FORM_SECONDS, duration

    # Can't determine — assume long-form
    return video_id, False, None


def fetch_youtube_rss(channel_id, cutoff_date):
    """Fetch recent videos from a YouTube channel RSS feed.
    Uses ThreadPoolExecutor to check durations in parallel."""
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    try:
        feed = feedparser.parse(url)
        if feed.bozo and not feed.entries:
            return [], []

        # First pass: collect entries that pass the date filter, but don't check duration yet
        candidates = []
        for entry in feed.entries[:15]:  # RSS returns ~15 latest
            published = None
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
            elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                published = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)

            if published and published < cutoff_date:
                continue

            video_id = entry.get('yt_videoid', '')
            if not video_id and 'link' in entry:
                link = entry.get('link', '')
                if 'v=' in link:
                    video_id = link.split('v=')[1].split('&')[0]

            title = entry.get('title', 'Unknown')
            desc = entry.get('summary', '')

            candidates.append({
                "video_id": video_id,
                "title": title,
                "desc": desc,
                "published": published,
                "entry_link": entry.get('link', ''),
            })

        # Second pass: check durations in parallel using ThreadPoolExecutor
        duration_results = {}
        if candidates:
            with ThreadPoolExecutor(max_workers=10) as executor:
                check_args = [(c["video_id"], c["title"], c["desc"]) for c in candidates]
                futures = [executor.submit(_check_duration_for_entry, args) for args in check_args]
                for future in futures:
                    try:
                        vid, is_short, duration = future.result(timeout=15)
                        duration_results[vid] = (is_short, duration)
                    except:
                        pass

        # Third pass: build results and shorts lists
        results = []
        shorts = []
        for candidate in candidates:
            video_id = candidate["video_id"]
            if video_id in duration_results:
                short, duration = duration_results[video_id]
            else:
                # Fallback if duration check failed
                short, duration = False, None

            item = {
                "title": candidate["title"],
                "url": f"https://www.youtube.com/watch?v={video_id}" if video_id else candidate["entry_link"],
                "video_id": video_id,
                "published": candidate["published"].isoformat() if candidate["published"] else "",
                "published_display": candidate["published"].strftime("%b %d") if candidate["published"] else "",
                "duration_seconds": duration,
                "duration_display": f"{duration // 60}m" if duration else "",
                "platform": "youtube",
            }

            if short:
                shorts.append(item)
            else:
                results.append(item)

        return results, shorts
    except Exception as e:
        print(f"  [WARN] RSS failed for {channel_id}: {e}", file=sys.stderr)
        return [], []


# ─── Main Scanner ─────────────────────────────────────────────────────────────

def scan_all_channels(days=1, category_filter=None, skip_dedup=False):
    # Catch-up mechanism: check if last run was more than 'days' ago
    if not skip_dedup:
        seen_log = load_seen_log()
        if seen_log:
            # Find the most recent first_seen timestamp
            most_recent = max(
                (v.get("first_seen", "") for v in seen_log.values() if v.get("first_seen")),
                default=None
            )
            if most_recent:
                try:
                    last_run = datetime.fromisoformat(most_recent)
                    gap_days = (datetime.now(timezone.utc) - last_run).days
                    if gap_days > days:
                        # Extend lookback to cover the gap, max 7 days to avoid going too far
                        extended_days = min(gap_days + 1, 7)
                        print(
                            f"Catch-up mode: extending lookback to {extended_days} days "
                            f"(last run was {gap_days} days ago)",
                            file=sys.stderr
                        )
                        days = extended_days
                except:
                    pass
    else:
        seen_log = {}

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    results = {}
    shorts_by_category = {}
    needs_web_search = []
    stats = {
        "total_new": 0,
        "total_shorts": 0,
        "categories_active": 0,
        "channels_scanned": 0,
        "channels_with_new": 0,
        "duplicates_filtered": 0,
    }

    for category, channels in CHANNELS.items():
        if category_filter and category != category_filter:
            continue

        category_videos = []
        category_shorts = []

        for ch in channels:
            stats["channels_scanned"] += 1

            if ch.get("yt_id"):
                videos, shorts = fetch_youtube_rss(ch["yt_id"], cutoff)
                new_videos = []
                for v in videos:
                    vid = v["video_id"]
                    if vid and vid in seen_log:
                        stats["duplicates_filtered"] += 1
                        continue
                    v["channel"] = ch["name"]
                    new_videos.append(v)
                    if vid:
                        seen_log[vid] = {
                            "title": v["title"],
                            "channel": ch["name"],
                            "first_seen": datetime.now(timezone.utc).isoformat(),
                        }

                if new_videos:
                    stats["channels_with_new"] += 1
                    category_videos.extend(new_videos)

                # Track shorts separately
                for s in shorts:
                    s["channel"] = ch["name"]
                    category_shorts.append(s)

            elif ch.get("search_name"):
                needs_web_search.append({
                    "channel": ch["name"],
                    "search_query": ch["search_name"],
                    "category": category,
                })

        if category_videos:
            stats["total_new"] += len(category_videos)
            stats["categories_active"] += 1
            results[category] = sorted(category_videos, key=lambda x: x.get("published", ""), reverse=True)

        if category_shorts:
            stats["total_shorts"] += len(category_shorts)
            shorts_by_category[category] = category_shorts

    if not skip_dedup:
        save_seen_log(seen_log)

    return {
        "results": results,
        "shorts": shorts_by_category,
        "needs_web_search": needs_web_search,
        "stats": stats,
        "cutoff": cutoff.isoformat(),
        "days": days,
        "run_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    }


def main():
    parser = argparse.ArgumentParser(description="Content Scout Scanner")
    parser.add_argument("--days", type=int, default=1, help="Lookback window in days (default: 1)")
    parser.add_argument("--category", type=str, default=None, help="Scan only this category")
    parser.add_argument("--no-dedup", action="store_true", help="Skip dedup (use for first run)")
    parser.add_argument("--output", type=str, default=None, help="Output file (default: stdout)")

    args = parser.parse_args()

    print(f"Content Scout — {args.days}-day lookback", file=sys.stderr)
    data = scan_all_channels(days=args.days, category_filter=args.category, skip_dedup=args.no_dedup)

    output = json.dumps(data, indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(output)
        print(f"Saved to {args.output}", file=sys.stderr)
    else:
        print(output)

    s = data["stats"]
    print(f"\n--- Scout Summary ---", file=sys.stderr)
    print(f"Scanned: {s['channels_scanned']} channels", file=sys.stderr)
    print(f"New long-form: {s['total_new']} videos from {s['channels_with_new']} channels across {s['categories_active']} categories", file=sys.stderr)
    print(f"Shorts filtered: {s['total_shorts']}", file=sys.stderr)
    print(f"Duplicates filtered: {s['duplicates_filtered']}", file=sys.stderr)
    print(f"Channels needing web search: {len(data['needs_web_search'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
