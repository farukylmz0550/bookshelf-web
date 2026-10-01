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
| chopin-nocturne-op9-no2.mp3 | Frédéric Chopin (1849) | sad — piano |
| beethoven-moonlight-sonata-i.mp3 | Ludwig van Beethoven (1827) | sad — piano |
| tchaikovsky-swan-lake-theme.mp3 | Pyotr I. Tchaikovsky (1893) | sad — harp |
| beethoven-fur-elise.mp3 | Ludwig van Beethoven (1827) | hopeful — piano |
| petzold-minuet-in-g.mp3 | Christian Petzold (attr. J. S. Bach, 1750) | neutral — guitar |
| mozart-eine-kleine-nachtmusik.mp3 | W. A. Mozart (1791) | happy — violin |
| vivaldi-spring-allegro.mp3 | Antonio Vivaldi (1741) | happy — violin |
| mozart-rondo-alla-turca.mp3 | W. A. Mozart (1791) | happier — piano |
| beethoven-ode-to-joy.mp3 | Ludwig van Beethoven (1827) | celebration — violin |

Each track is a ~60 s performance (theme repeats / second-half reprises),
rendered with Western instrument voices (piano, harp, violin, guitar) and an
old, vintage treatment (tape warmth, wow & flutter, faint hiss) — see
`scripts/render-annual-audio.mjs`.

## Piece selection

The application deterministically selects ONE piece per experience from the
user's yearly-goal progress mood tier (2026-10-01 rule):
under 25% of the goal → sad · 25–49% → hopeful · 50–74% → neutral · 75–99% →
happy · exactly the goal → happier · beyond the goal → celebration — and the
year hash picks within the tier's pool. The user cannot choose, shuffle, or
stream music. The selected track plays once (no loop), respects browser
autoplay policies ("Enable sound" fallback), and can be muted by the user.

## Regenerating

```bash
node scripts/render-annual-audio.mjs --encode
```

Deterministic — same input data always produces the same render.
