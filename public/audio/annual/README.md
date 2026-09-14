# Annual Summary Audio — CC0

Pre-rendered background music for the BookShelf Annual Reading Summary (v2.7.0).

## License

**CC0 1.0 Universal** — the rendered performances in this directory are
dedicated to the public domain (see the repo-root [`LICENSE-CC0`](../../../LICENSE-CC0)).
You may use, remix, and redistribute these audio files for any purpose,
including commercial use, without attribution — though attribution is
embedded in each file's ID3 metadata:

| Tag | Value |
|---|---|
| artist | `farukylmz0505` |
| album | Book Shelf — Annual Summary Audio |
| license | CC0 1.0 Universal — rendered performance dedicated to the public domain |

## Tracks

All eight compositions are **public domain** (the composers died more than
70 years ago). The note transcriptions used for rendering were made by the
BookShelf author from public-domain scores, and the audio was rendered once
at development time by `scripts/render-annual-audio.mjs` (offline synth →
ffmpeg/libmp3lame, 96 kbps mono). The runtime never synthesizes audio.

| Slug | Composer (d.) | Mood |
|---|---|---|
| chopin-nocturne-op9-no2.mp3 | Frédéric Chopin (1849) | sad |
| beethoven-moonlight-sonata-i.mp3 | Ludwig van Beethoven (1827) | sad |
| petzold-minuet-in-g.mp3 | Christian Petzold (attr. J. S. Bach, 1750) | neutral |
| beethoven-fur-elise.mp3 | Ludwig van Beethoven (1827) | neutral |
| mozart-eine-kleine-nachtmusik.mp3 | W. A. Mozart (1791) | happy |
| mozart-rondo-alla-turca.mp3 | W. A. Mozart (1791) | happy |
| vivaldi-spring-allegro.mp3 | Antonio Vivaldi (1741) | happy |
| beethoven-ode-to-joy.mp3 | Ludwig van Beethoven (1827) | celebration |

## Piece selection

The application deterministically selects ONE piece per experience from the
user's yearly-goal progress (sad → celebration moods) and the year hash.
The user cannot choose, shuffle, or stream music. The selected track plays
once (no loop), respects browser autoplay policies ("Enable sound" fallback),
and can be muted by the user.

## Regenerating

```bash
node scripts/render-annual-audio.mjs --encode
```

Deterministic — same input data always produces the same render.
