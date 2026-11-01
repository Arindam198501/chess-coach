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
2. Press **Start live camera**. Make sure the **whole board, all four edges, is in the picture**. Then tap the 4 corners of the **squares area** (where the 64 squares end, not the wooden frame) **in any order**. The app works out a1 by itself from the pieces. Check that the gold grid sits on the squares. If the labels are wrong, tap **↻ Turn labels**.
3. Set up your pieces in the starting position. The engine plays **only on the screen**, so you never move its pieces. You can leave the engine's pieces off your board entirely. Choose **I play** and the **Engine** level, then press **Start game**.
4. When the game starts, the camera shrinks to a small thumbnail at the top right. It keeps watching the board. Tap it to open the full camera view, for example to re-mark the corners.
5. Make your move and take your hand away. About a second later the app reads the move.
6. The engine replies **on the screen board**: a green card says e.g. **"♜ Elephant h1 → h5"**, a green arrow shows it, and the voice reads it out. Nothing to do on your real board. Just make your next move.
7. **If the engine captures one of your pieces,** the card says e.g. "Remove your Camel from c4". Take it off your real board and the camera notices, or tap ✓ Piece removed.

**Piece names:** the default is Elephant · Camel · Horse. Switch to Rook · Bishop · Knight under **Names**.

**If the camera misreads a move,** tap one of the suggested moves or tap the move on the screen board. If the real board matches the screen but the app seems confused, press **⟳ Re-sync board**.

**Photo mode (backup):** if the live camera won't work, press **📷 Take photo** after each move (or **🖼 Upload image**). Tap the corners on the first photo. If the phone moves between photos, drag the dots back onto the corners and press **Re-read photo**.

**Without a camera:** tap moves on the screen board.

Other buttons: **💡 Hint** suggests a move. **↶ Take back** undoes your last move and the engine's reply. After taking back, put the pieces back and press Re-sync.

## Getting reliable reads on a real board

- **Keep the phone as still as possible** (a stand, tripod or book stack). The app follows small camera movements by tracking the board's border. If it gets knocked a lot, tap the camera thumbnail, re-mark the corners and press **Re-sync board**.
- Shoot from as high and straight above as you can. Tall pieces then lean less into neighbouring squares.
- **Glossy boards:** keep the glare spot small. Move the lamp, or tilt the phone slightly so the reflection falls off the board.
- If the app is unsure, it asks "Did you play …?". One tap confirms.

## Known limits (stage 1)

- Games must start from the normal starting position. Your real board shows only your own pieces' positions; the full game is on the screen board. The camera spots *which squares changed*; it doesn't identify the pieces.
- Steep camera angles, moving shadows or a bumped camera cause misreads. Re-mark the corners and press Re-sync.
- **Change threshold** slider: move it lower if moves are missed, higher if it reacts to shadows.

## Other tabs

- **👥 2 Players:** two people play on one screen (pass-and-play). Both players enter their names first. You can undo, offer a draw or resign, and optionally turn the board around after every move.
- **📚 Learn:** courses for stronger players:
  - **Openings repertoire:** Ruy Lopez, Italian, Najdorf, QGD, King's Indian, Caro-Kann and London. Each has an explained main line, then a drill where you play your side from memory.
  - **Middlegame strategy:** outposts, open files and the 7th rank, good and bad bishops, isolated queen's pawn, and the Greek gift sacrifice.
  - **Tactics & calculation:** forks, skewers and discovered checks, then calculation sets taken from real engine games.
  - **Endgames:** opposition, the rule of the square, Lucena and Philidor.
  - **Checkmate in 1, 2 and 3:** classic mating patterns, then puzzle sets.

  Every puzzle answer was verified with Stockfish 19. If you find a different move that also works, the app asks Stockfish and accepts it. Progress is saved on your device.
- **📜 History:** every game (vs the engine and two-player) is saved automatically, with names, date and result. Tap a game to replay it move by move, copy it as PGN, or continue an unfinished two-player game. Tap **☑ Select / delete** to tick individual games or **Select all**, then delete them. Deleting asks for a second tap to confirm.

## If the camera doesn't read your moves

During a game, the line above the move card shows what the camera is doing ("Watching…", "Movement seen…", "reading…"). If a move isn't recognised, tap **📸 Save snapshot**. It saves an image of what the camera compared, which you can send for diagnosis.

## Coming next

- **Stage 2:** warnings right after inaccuracies, mistakes and blunders (with a take-back option), and a full review after each game.
- **Stage 3:** saved mistake history, puzzles built from your mistakes, and a stats dashboard.
