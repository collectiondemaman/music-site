from __future__ import annotations

import html
import json
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parent
SONGS_FILE = ROOT / "data" / "songs.json"
OUTPUT_DIR = ROOT / "song"
SITE_URL = "https://miyaomusic.com"
SHARE_IMAGE = f"{SITE_URL}/logo.png"


def song_key(song: dict) -> str:
    audio = str(song.get("audio") or "")
    filename = audio.rsplit("/", 1)[-1]
    return filename.rsplit(".", 1)[0] or "song"


def share_page(song: dict) -> str:
    key = song_key(song)
    title = str(song.get("title") or key)
    category = str(song.get("category") or "原创词曲")
    page_url = f"{SITE_URL}/song/{quote(key)}.html"
    target_url = f"{SITE_URL}/?song={quote(key)}"
    meta_title = f"《{title}》｜老湛原创词曲"
    description = f"在线试听老湛原创词曲作品《{title}》 · {category}"

    esc_title = html.escape(title, quote=True)
    esc_meta_title = html.escape(meta_title, quote=True)
    esc_description = html.escape(description, quote=True)
    esc_page_url = html.escape(page_url, quote=True)
    esc_target_url = html.escape(target_url, quote=True)

    return f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc_meta_title}</title>
  <meta name="description" content="{esc_description}">
  <link rel="canonical" href="{esc_page_url}">
  <meta property="og:type" content="music.song">
  <meta property="og:site_name" content="老湛 · 原创词曲作品">
  <meta property="og:title" content="{esc_meta_title}">
  <meta property="og:description" content="{esc_description}">
  <meta property="og:url" content="{esc_page_url}">
  <meta property="og:image" content="{SHARE_IMAGE}">
  <meta property="og:image:secure_url" content="{SHARE_IMAGE}">
  <meta property="og:image:alt" content="迷遥音乐">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{esc_meta_title}">
  <meta name="twitter:description" content="{esc_description}">
  <meta name="twitter:image" content="{SHARE_IMAGE}">
  <meta itemprop="name" content="{esc_meta_title}">
  <meta itemprop="description" content="{esc_description}">
  <meta itemprop="image" content="{SHARE_IMAGE}">
  <meta http-equiv="refresh" content="1;url={esc_target_url}">
  <style>
    * {{ box-sizing: border-box; }}
    body {{ min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; color: #f4eadc; background: #090806; font-family: "Microsoft YaHei", "PingFang SC", system-ui, sans-serif; }}
    main {{ width: min(420px, 100%); padding: 28px; border: 1px solid rgba(217,164,65,.3); border-radius: 16px; text-align: center; background: #15110c; }}
    img {{ width: 112px; height: 112px; object-fit: cover; border-radius: 14px; }}
    h1 {{ margin: 15px 0 5px; color: #fff7eb; font-size: 22px; }}
    p {{ margin: 0 0 18px; color: #ac9c87; }}
    a {{ display: inline-block; padding: 9px 18px; border-radius: 999px; color: #160c05; background: #f07822; text-decoration: none; font-weight: 700; }}
  </style>
</head>
<body>
  <main>
    <img src="{SHARE_IMAGE}" alt="迷遥音乐">
    <h1>《{esc_title}》</h1>
    <p>老湛原创词曲 · {html.escape(category)}</p>
    <a href="{esc_target_url}">进入试听</a>
  </main>
  <script>window.location.replace({json.dumps(target_url, ensure_ascii=False)});</script>
</body>
</html>
'''


def main() -> None:
    songs = json.loads(SONGS_FILE.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    expected = set()
    for song in songs:
        key = song_key(song)
        output = OUTPUT_DIR / f"{key}.html"
        output.write_text(share_page(song), encoding="utf-8", newline="\n")
        expected.add(output.name)

    for old_page in OUTPUT_DIR.glob("*.html"):
        if old_page.name not in expected:
            old_page.unlink()

    print(f"Generated {len(expected)} song share pages in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
