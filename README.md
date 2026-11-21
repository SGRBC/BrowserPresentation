# Lyrics Presentation

Browser-based lyrics presentation software (HTML + CSS + JavaScript modules + JSON config). Songs come from a Google Sheet, with `songs.json` as a fallback.

## Run

Start it with the script for your system. Each one finds Python, starts the server on http://127.0.0.1:8000 (localhost only) as a background process (no terminal window stays open) and opens the app in your browser. If the server is already running it just opens the browser. Server output is written to `presentation-server.log` in your temp folder.

| System | How |
|---|---|
| Windows | Double-click **`start.bat`** |
| macOS | Double-click **`start.command`** (or run `./start.sh`). If macOS blocks it, right-click, Open |
| Linux | Run `./start.sh` in a terminal |
| Android | Run **`./start-android.sh`** (or `./start.sh`) in Termux / terminal app |

On macOS, Linux, and Android the scripts may need to be made executable once: `chmod +x start.sh start.command start-android.sh`. Use another port with `PORT=8080 ./start.sh` or `PORT=8080 ./start-android.sh`. The server stops by itself a few seconds after the presentation page (`index.html`) is closed; closing the output window does not stop it. If the page was never opened, end the `BrowserPresentationServer` process (Task Manager on Windows, `pkill -f server.py` on macOS, Linux and Android). To run it in the foreground with a visible console instead (for debugging), run `python server.py`.

To start it manually instead: browsers block ES modules and `fetch` on `file://`, so serve the folder locally, bound to localhost only:

```
py -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000/index.html, then click **Open output window** and drag that window to the projector/second screen. Double-click it (or press `F`) for fullscreen.

## Online mirror (view the current slide on your phone)

`client.html` is a read-only viewer you can host on GitHub Pages. It shows the same slide, theme and blank state as the output window. The presenter and the viewer cannot talk directly (`BroadcastChannel` only works inside one browser), so the presenter sends each slide to a small public relay (ntfy, `https://ntfy.sh` by default) and the viewer subscribes to it.

1. Publish this folder on GitHub Pages (repository **Settings → Pages**, deploy from the branch). Do not commit your sheet ID, API keys or private songs: the app keeps keys in browser storage only, but `config.json` and `songs.json` are published with the site.
2. In the presenter, open **Settings → Online mirror**, tick **Send the current slide online**, paste the address of `client.html` on your GitHub Pages site, and press **Save settings**.
3. Connect the phone in one of two ways:
   - **Scan the QR code:** Settings → Online mirror always shows a QR code (it does not need the mirror to be switched on first). Open `client.html` on the phone, press **Scan QR code instead** and point the camera at it. The camera needs HTTPS (GitHub Pages has it) and your permission; the image is processed on the phone and never uploaded. If you pasted the `client.html` address, a phone's normal camera app can also scan the code and open the viewer directly.
   - **Open the link:** open the **Link to open on the phone** (type it, or send it to yourself). The code is in the part after `#`, which browsers do not send to any server, and the viewer removes it from the address bar and remembers it.
   - Or type the access code into the viewer by hand.

Notes:
- The **access code** is the only secret: anyone who has it can watch your slides, and the QR code contains it, so do not show the QR code to the audience. **New code** replaces it; old viewers stop updating.
- Only text, theme colours and the blank flag are sent. Pictures, videos, presentation slides and background images stay on the presenter's computer; the viewer shows a note for those slides.
- Slide text passes through the relay server. For private content run your own ntfy server (HTTPS only) and enter it under **Relay server** in both the presenter and the viewer's "Relay server" box. ntfy.sh limits request rates for anonymous use, so very fast slide changes may be dropped.
- The viewer reconnects by itself and receives the latest slide when the phone wakes up.

## Song Library (Google Sheet or Local Library)

1. Open **Settings** via the hamburger menu (three lines, top right).
2. Choose **Song library source**:
   - **Google Sheet**:
     - Row 1 must contain headers: `title`, `lyrics`, and optionally `author` (names configurable in `config.json`).
     - Put one song per row (leave an empty line between verses in the `lyrics` cell for new slides).
     - Share sheet as **Anyone with the link can view**.
     - Paste the sheet URL or ID in Settings and click **Save settings**.
   - **Local Song Library (JSON/CSV)**:
     - Click **Import local songs** and pick a local `.json`, `.csv`, or `.txt` file containing your songs.
     - Supports JSON (`{ "songs": [ { "title": "...", "lyrics": "..." } ] }`) and CSV (`title,lyrics,author`).
     - Or click **Load default songs.json** to use the local fallback file.

Each song starts with a title slide (song title, with the author underneath if set). Turn it off with **Title slide at start of each song** in Settings, or `"showTitle": false` in `config.json`.

The last slide of every song or custom slide is marked in the operator window: a red **Last slide** tag and underline in the slide list, and a **Last slide** badge in the corner of the preview while it is the current slide. The marker is never shown on the output window or the online viewer.



## Files

| File | Purpose |
|---|---|
| `index.html` | Operator console |
| `output.html` | Audience screen (receives slides via `BroadcastChannel`) |
| `styles.css` | All styling and screen themes |
| `app.js` | Sheet loading, slide splitting, controls |
| `screen.js` | Shared slide renderer (text, pictures, video) |
| `client.html`, `client.js` | Online viewer for phones (host on GitHub Pages) |
| `relay.js` | Online mirror: sends slides to / receives slides from the relay |
| `qr.js`, `vendor/zxing/` | QR code creation (presenter) and scanning (viewer), using zxing-wasm 3.1.6 (MIT), served from this site |
| `media.js` | Browser storage (IndexedDB) for videos and presentation pictures |
| `pptx.js` | Presentation (.pptx/.ppsx/.odp) reader |
| `pdfimport.js`, `vendor/pdfjs/` | PDF page renderer, using PDF.js 6.5.438 (Apache-2.0), served from this site |
| `drive.js` | Google Drive folder listing and MP3 download |
| `config.json` | Sheet ID/columns and default theme |
| `songs.json` | Offline fallback songs |
| `start-android.sh` | Android / Termux launcher |

## Custom slides

Open **Custom slide** under the **Library** and type your own text (a blank line starts a new slide).

- **Show now** puts it on screen immediately. Nothing is saved.
- **Save to library** stores it in the library next to the songs, marked "Custom slide". There you can show it, edit it (pencil), delete it (×), or add it to the set list with **+**.
- **Background image:** choose a JPG, PNG, WebP or GIF file under the text. It is scaled down (max 1600 px) and stored as a JPEG inside the slide, so it works offline and appears on the output window. Use the **Darken image** slider to keep the text readable. The text can be left empty for an image-only slide. **Remove image** clears it.
- Custom slides have no title slide and are stored in browser localStorage, like the set list. Browsers limit localStorage to roughly 5 MB, so expect room for about 10 to 20 images; the app tells you if saving fails.

## Video and Presentations

In the **Custom slide** editor, use the **Video, PDF or Presentation** file picker.

**Video** (MP4/H.264 is the safest choice; WebM, Ogg and MOV work if your browser can play them; up to 2 GB)
- The video becomes one slide. Any text you type is drawn over it.
- Under the preview, **Pause/Play** and **Restart** control it. Keys: `K` pause/play, `S` restart.
- Pressing `.` (blank) pauses the video and hides it; un-blanking resumes it.
- Video sound plays from the **operator window** (the preview), not the output window. Browsers block sound in a window nobody has clicked, so the output window is always silent and needs no click. Use the computer's speakers, or make sure the sound goes to the same device as the projector. The preview is muted while **Live** is off. Sound and picture are two separate players, so they can drift apart slightly. Tick **Mute** in the editor for silent clips.

**PDF files** (up to 200 MB and 300 pages)
- Choose a PDF under Custom slide.
- Each page is drawn by PDF.js exactly as the PDF defines it (layout, fonts, images, colours) and stored as a picture, up to 2560 × 1440 pixels. The slide shows the whole page, scaled to fit the screen without cropping or stretching, so the layout matches the PDF. If the page and the screen have different proportions, the empty area stays black.
- The conversion happens in the browser, so it also works on GitHub Pages and needs no server.
- `vendor/pdfjs/` holds only what rendering needs (20 files). Left out: the PDF scripting engine, the fallbacks for browsers without WebAssembly, the Chinese/Japanese/Korean character maps, and the JBIG2 decoder. A PDF that relies on those character maps without embedding its fonts may show wrong characters, and black-and-white scans stored as JBIG2 (some scanner and fax PDFs) may show a blank image.
- Password-protected and damaged PDFs are rejected with a message. Form fields and links are not interactive; only the printed look of the page is kept.

**Presentations** (`.pptx`, `.ppsx`, or `.odp`, up to 200 MB and 300 slides)
- Choose a presentation file under Custom slide.
- Slides are automatically rendered and exported as full-resolution images (preserving all formatting, shapes, fonts, and backgrounds) and added directly to your Set List and Library.
- Old `.ppt` files are not supported; in PowerPoint use *Save As* and choose `.pptx` or `.odp`. Password-protected files are rejected.

Videos and pictures are stored in the browser (IndexedDB), not in the set list or in localStorage, so they are only available in the browser and on the computer where you imported them. Clearing site data removes them. If the browser's storage is full you will see a message. Files that are no longer used by any custom slide are removed automatically.


## Audio Library (Local Audio or Google Drive)

The **Audio library** box (under the Audio set list) lets you browse and add audio tracks to the Audio set list. Press **+** (or double-click) to add a track to the set list, then click it there to play. Audio plays on the operator computer's speakers.

In **Settings** (hamburger menu), select your **Audio source**:

### Option A: Local Audio Library (Offline)
- Choose **Local Audio Library** under Audio source.
- Select a local music folder (via folder picker) or individual audio files (MP3, WAV, OGG, M4A, FLAC).
- Tracks and folder hierarchy are stored locally in the browser (IndexedDB) and remain available offline.

### Option B: Google Drive Audio (Cloud)
- Choose **Google Drive** under Audio source.
- Share your Google Drive folder as **Anyone with the link can view**.
- In Settings, enter your **Google Drive folder URL** and **Google API key** (with Google Drive API enabled).

- **Search this folder** filters the files and folders you are looking at as you type (not case sensitive). It clears when you open a folder or go back.
- **Auto-play (Settings → Audio Library):** tick *Auto-play matching audio with the first verse*. Then, while Live is on, showing a song's first verse (not its title slide) plays the audio track whose name matches the song title. It looks in the Audio set list first, then in the selected audio library (a track found there is added to the set list). It does nothing for custom slides, Bible verses or video slides. If the browser blocks sound, press play on the player once.

- **Audio set list:** drag a track to reorder it, use the **×** button to remove it, **Track** buttons to jump to the previous/next one, and the player to pause or seek. A track plays once and then stops; the next one never starts by itself. Pick it yourself. The list is saved in this browser, and removing the track that is playing does not stop it. Each track is downloaded when it starts playing.
- Click a folder to open it, **Back** to go up, **Refresh** to reload the listing. Only folders and `.mp3` files are shown (up to 1000 entries per folder).
- Files up to 150 MB are supported and played from memory, so a long track can take a moment to start.
- The key is stored only in this browser's localStorage, like the ESV key; it is not written to `config.json` or any file, and it is sent to Google in a request header rather than in the address.

## Bible verses (ESV)

1. Get a free API key at https://api.esv.org/ (create an account, then an application). Paste it into **Settings → ESV API key** and press **Save settings**. The key is stored only in this browser's localStorage; it is not written to `config.json` or any file.
2. Open **ESV Bible verses** under the **Library**, type a reference (e.g. `John 3:16-18`, `Psalm 23`, `Romans 8:1-4; 12:1-2`), choose how many verses go on each slide, and press **Fetch** (or Enter).
3. Check the preview, then use **Show now**, **Save to library**, or **Add to set list** (this also saves it to the library). Saved passages appear in the library as "Bible (ESV)" and can be edited like other custom slides, and fetching the same reference again replaces the saved copy.

Each slide ends with the reference and "(ESV)". Passages are saved locally, so they still work offline once saved. The ESV text is subject to Crossway's API terms and copyright rules; check them for how much you may store and display.


## Set list

- Press **+** next to a song to add it to the set list (the middle column). The same song can be added more than once.
- Drag an entry to reorder the set list, and use the **×** button to remove one. Click an entry to show that song.
- The output window follows the set list only: clicking an item in the library does not change the output. Add songs with **+** or by double-clicking them, then click them in the set list to display them. (The **Show now** buttons in the custom slide and Bible editors are explicit exceptions: they display immediately.)
- Pressing next on the last slide of a set list song moves to the first slide of the next song; pressing previous on a first slide goes back to the previous song's last slide.
- **Export** downloads `setlist_<date>_<time>.json` (for example `setlist_2026-11-09_16-30-05.json`); **Import** loads one. Entries are matched to songs by title and author, so a song renamed in the sheet shows as "(not found)" and is skipped. The audio set list is not exported or imported (importing a file clears the audio set list).
- The set list is saved in browser localStorage.

## Layout

Three columns, separated by draggable borders: drag a border left or right to resize the columns (double-click it to reset, or focus it and use the arrow keys, Shift for bigger steps, Home to reset). Sizes are remembered in this browser. The columns are: the **Library** (songs, with the **Custom slide** and **Bible verses** editors underneath) on the left, the **Set list** (with the **Audio set list** and the **Google Drive audio** browser underneath) in the middle, and the controls, preview and slide list for the current song on the right.

**Presider mode:** Toggleable via the **Presider mode** button in the top bar. In Presider mode, the output preview screen, stage controls, "Open output window" button, audio set list, and audio source browser are hidden, and automated audio auto-play is disabled. The column layout dynamically adjusts so the set list and lyrics/verses preview columns occupy 50% of the window width each, while the library column is hidden.

## Settings

Settings are hidden in a drawer. Click the burger button (three lines) at the top right to open it; close it with the x, by clicking outside it, or with Esc. **Save settings** closes it too.

**Lyric slides background image:** under the colour settings, choose a JPG, PNG, WebP or GIF to display as the background for all lyric slides (Google Sheet, songs.json, and local songs). Use the **Darken image** slider to ensure text readability. **Remove** goes back to solid background colour. Individual custom slides with their own background image will continue to use their custom image.

**Blank screen image:** under the colour settings, choose a JPG, PNG, WebP or GIF to show on the output window whenever it is blank (the `.` key or the Blank button) instead of a plain black screen. It is scaled to fit the screen, stored in this browser (IndexedDB) and used by both the preview and the output window. **Remove** goes back to black. Showing a song, video or slide hides it again.

## Controls

`→` / `Space` next slide · `←` previous · `.` blank screen · `F` Live on/off (when off, the output window is blank while the preview keeps working) · `N` / `P` next / previous set list song · `K` pause/play video · `S` restart video. Settings are stored in browser localStorage.

**App keys:** `R` reload the sheet · `O` open the output window · `I` open the Settings menu. Each key is shown next to its button, for example "Reload sheet (R)". They are ignored while you are typing in a field, while Settings is open, and when Ctrl, Cmd or Alt is held.

**Jump to a field** (the cursor goes straight in, and the letter is not typed): `L` library search · `A` Google Drive audio search · `C` Custom slide name (opens the editor) · `B` Bible verse reference (opens the editor). The key is shown next to each label, for example "Custom slide (C)", the same way as "Live (F)". Press `Esc` to fold the Custom slide, Bible verses and Google Drive audio boxes (and leave the field you are typing in) so the other keys work again; if Settings is open, `Esc` closes it first. These keys are ignored while you are typing in a field, while Settings is open, and when Ctrl, Cmd or Alt is held.
