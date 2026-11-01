# Chess Cam Coach: stage 1

Play chess on your real board against Stockfish. The camera reads your moves, and the app speaks and shows the engine's reply for you to play on the board.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The app |
| `engine/stockfish-19-lite-single.js` + `.wasm` | The Stockfish 19 engine (GPL licence in `engine/STOCKFISH-LICENSE.txt`) |

Keep the files together exactly as they are. The `engine` folder must stay next to `index.html`.

## Put it online (free, about 5 minutes): needed for the phone camera

Phone browsers only allow the camera on **https://** pages. GitHub Pages gives you one for free.

1. Sign in at **github.com** (or create a free account).
2. Click **+** (top right) → **New repository**. Name it `chess-coach`, choose **Public**, then click **Create repository**.
3. On the next page, click **uploading an existing file**. Drag in `index.html` **and the whole `engine` folder**, then click **Commit changes**.
4. Go to the repository's **Settings → Pages**. Under *Branch*, pick **main** and **/(root)**, then click **Save**.
5. After a minute or two, your app is at
   **https://YOUR-USERNAME.github.io/chess-coach/**
   Open it on your phone and on your laptop. On Android, use Chrome's menu → **Add to Home screen** for one-tap access.

To update later, upload the new files to the same repository. They replace the old ones.

### Laptop only, with no hosting

The camera also works on `localhost`. In this folder, run:

```
python -m http.server 8000
```

Then open **http://localhost:8000** in Chrome. Double-clicking `index.html` opens it as a file, and then the camera and Stockfish won't work.

## Playing

1. **Camera:** put the phone or a USB webcam on a stand **directly above** the board, with the whole board in view and even lighting.
2. Press **Start live camera**, then tap the 4 outer board corners in order: **a1 → h1 → h8 → a8** (a1 is White's bottom-left). Check that the gold grid lines up with the squares, and drag a dot to adjust if needed.
3. Set up the starting position, choose **I play** and the **Engine** level (about 1400 up to full strength), then press **Start game**.
4. When the game starts, the camera shrinks to a small thumbnail at the top right. It keeps watching the board. Tap it to open the full camera view, for example to re-mark the corners.
5. Make your move and take your hand away. About a second later the app reads the move.
6. The engine's reply appears in a big green card, e.g. **"♜ Elephant h1 → h5"**, with a green arrow on the screen board, and is spoken aloud. Play it on your board, and the app confirms it automatically.

**Piece names:** the default is Elephant · Camel · Horse. Switch to Rook · Bishop · Knight under **Names**.

**If the camera misreads a move,** tap one of the suggested moves or tap the move on the screen board. If the real board matches the screen but the app seems confused, press **⟳ Re-sync board**.

**Photo mode (backup):** if the live camera won't work, press **📷 Take photo** after each move (or **🖼 Upload image**). Tap the corners on the first photo. If the phone moves between photos, drag the dots back onto the corners and press **Re-read photo**.

**Without a camera:** tap moves on the screen board.

Other buttons: **💡 Hint** suggests a move. **↶ Take back** undoes your last move and the engine's reply. After taking back, put the pieces back and press Re-sync.

## Known limits (stage 1)

- Games must start from the normal starting position. The camera spots *which squares changed*; it doesn't identify the pieces.
- Steep camera angles, moving shadows or a bumped camera cause misreads. Re-mark the corners and press Re-sync.
- **Change threshold** slider: move it lower if moves are missed, higher if it reacts to shadows.

## Coming next

- **Stage 2:** warnings right after inaccuracies, mistakes and blunders (with a take-back option), and a full review after each game.
- **Stage 3:** saved mistake history, puzzles built from your mistakes, opening drills, tactics puzzles and a stats dashboard.
