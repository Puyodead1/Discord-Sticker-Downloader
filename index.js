/*
 *  MIT License
 *
 *  Copyright (c) 2021 Puyodead1
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the "Software"), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in all
 *  copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *  SOFTWARE.
 *
 */

const fetch = require("node-fetch").default;
const path = require("path");
const { mkdir } = require("fs/promises");
const fs = require("fs");
const rimraf = require("rimraf");
const childProcess = require("child_process");
const renderLottie = require("puppeteer-lottie");
const apng2gif = require("apng2gif");
const gifsiclePath = require("gifsicle");

const workingDir = path.join(__dirname, "temp");

/**
 * Creates a gif from png frames
 * @param {*} filepath path to frames
 * @param {*} outpath path to output gif
 * @returns ffmpeg command
 */
const ffmpegCmd = (filepath, outpath) =>
  `ffmpeg -y -framerate 60 -i "${filepath}" -filter_complex "[0:v] fps=50,split [a][b];[a] palettegen [p];[b][p] paletteuse" "${outpath}"`;

/**
 * Gets the url to a sticker apng
 * @param {*} id  sticker id
 * @returns url for apng sticker url
 */
const getAPNG = (id) => {
  return `https://media.discordapp.net/stickers/${id}.png?passthrough=true`;
};

/**
 * gets the url to a stickers lottie json file
 * @param {*} id sticker id
 * @returns url for sticker lottie json
 */
const getLottie = (id) => {
  return `https://discord.com/stickers/${id}.json`;
};

/**
 * Gets the users sticker list
 * @returns list of users available stickers
 */
function getStickers() {
  return new Promise((resolve, reject) => {
    fetch("https://canary.discord.com/api/v9/users/@me/sticker-packs", {
      headers: {
        accept: "*/*",
        authorization: "discord token",
      },
      method: "GET",
    })
      .then((res) => {
        if (res.ok) return res.json();
        else rejects(res.statusText);
      })
      .then((res) => resolve(res))
      .catch(reject);
  });
}

/**
 * creates a promisified child process
 * @param {*} child  child process
 * @returns promise
 */
function promiseFromChildProcess(child) {
  return new Promise(function (resolve, reject) {
    child.addListener("error", reject);
    child.addListener("exit", resolve);
    child.addListener("message", (msg, _) => console.log(msg.toString()));
  });
}

/**
 * converts apng to gif
 * @param {*} inPath in apng path
 * @param {*} outPath out gif path
 * @returns
 */
function convert(inPath, outPath) {
  return new Promise((resolve, reject) => {
    apng2gif(inPath, outPath).then(resolve).catch(reject);
  });
}

function resizeGif(inPath, outPath) {
  return new Promise((resolve, reject) => {
    const child = childProcess.execFile(gifsiclePath, [
      "--resize",
      "143x143",
      "-i",
      inPath,
      "-o",
      outPath,
    ]);

    child.on("exit", (code) => {
      if (code == 0) resolve();
      else reject(code);
    });
    child.on("error", reject);
  });
}

/**
 * Downloads a file
 * @param {*} url url
 * @param {*} path output path
 */
const downloadFile = async (url, path) => {
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(path);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
};

/**
 * Promisifies rimraf
 * @param {*} path directory path
 * @returns void
 */
function rimrafAsync(path) {
  return new Promise((resolve, reject) => {
    rimraf(path, (err) => {
      if (err) reject(err);
      else resolve(0);
    });
  });
}

(async () => {
  // const stickers = await getStickers().catch(console.error);
  const stickers = require("./data.json");
  if (!fs.existsSync(workingDir)) {
    await mkdir(workingDir);
  }
  for (const pack of stickers) {
    // format type 2 is apng
    // format type 3 is lotte
    const stickerPack = pack.sticker_pack;
    const packName = stickerPack.name;
    console.log(
      `Processing pack: '${packName}' (${stickers.indexOf(pack)}/${
        stickers.length
      })`
    );
    const packDir = path.join(__dirname, "stickers", packName);

    const packStickers = stickerPack.stickers;
    for (const sticker of packStickers) {
      const stickerName = sticker.name;
      console.log(
        `Processing sticker: '${stickerName}' (${packStickers.indexOf(
          sticker
        )}/${packStickers.length})`
      );
      const formatType = sticker.format_type;
      const stickerId = sticker.id;
      if (formatType == 2) {
        const packAPNGDir = path.join(packDir, "APNG");
        const packDir143GIF = path.join(packDir, "GIF-143");
        const packDirLargeGIF = path.join(packDir, "GIF-Large");
        if (!fs.existsSync(packAPNGDir)) {
          await mkdir(packAPNGDir, { recursive: true });
        }
        if (!fs.existsSync(packDir143GIF)) {
          await mkdir(packDir143GIF, { recursive: true });
        }
        if (!fs.existsSync(packDirLargeGIF)) {
          await mkdir(packDirLargeGIF, { recursive: true });
        }
        const stickerPathAPNG = path.join(packAPNGDir, `${stickerName}.png`);
        const stickerPathGIF143 = path.join(
          packDir143GIF,
          `${stickerName}.gif`
        );
        const stickerPathGIFLarge = path.join(
          packDirLargeGIF,
          `${stickerName}.gif`
        );
        const url = getAPNG(stickerId);
        // apng - native
        if (!fs.existsSync(stickerPathAPNG)) {
          console.log("  Downloading APNG...");
          await downloadFile(url, stickerPathAPNG).catch(console.error);
        }
        // gif
        if (!fs.existsSync(stickerPathGIFLarge)) {
          await convert(stickerPathAPNG, stickerPathGIFLarge);
          console.log("    Converting large...");
          console.log("    Conversion of large complete");
        }

        if (!fs.existsSync(stickerPathGIF143)) {
          if (fs.existsSync(stickerPathGIFLarge)) {
            console.log("    Resizing 143...");
            await resizeGif(stickerPathGIFLarge, stickerPathGIF143).catch(
              console.error
            );
            console.log("    Resizing of 143 complete.");
          } else {
            console.error(
              "    Can't resize GIF to 143 because the large version doesn't exist!"
            );
            continue;
          }
        }
      } else if (formatType == 3) {
        const packDirLottie = path.join(packDir, "Lottie");
        const packDir143GIF = path.join(packDir, "GIF-143");
        const packDirLargeGIF = path.join(packDir, "GIF-Large");
        if (!fs.existsSync(packDirLottie)) {
          await mkdir(packDirLottie, { recursive: true });
        }
        if (!fs.existsSync(packDir143GIF)) {
          await mkdir(packDir143GIF, { recursive: true });
        }
        if (!fs.existsSync(packDirLargeGIF)) {
          await mkdir(packDirLargeGIF, { recursive: true });
        }
        const stickerPathLottie = path.join(
          packDirLottie,
          `${stickerName}.json`
        );
        const stickerPathGif143 = path.join(
          packDir143GIF,
          `${stickerName}.gif`
        );
        const stickerPathGifLarge = path.join(
          packDirLargeGIF,
          `${stickerName}.gif`
        );
        const url = getLottie(stickerId);
        await downloadFile(url, stickerPathLottie).catch(console.error);

        const workingPath = path.join(workingDir, "frame-%d.png");
        const ffmpgCmd143 = ffmpegCmd(workingPath, stickerPathGif143);
        await renderLottie({
          path: stickerPathLottie,
          output: workingPath,
          height: 143,
          width: 143,
        })
          .then(() => console.log("    Render Complete (143)"))
          .catch(console.error);
        await promiseFromChildProcess(childProcess.exec(ffmpgCmd143)).catch(
          console.error
        );
        await rimrafAsync(path.join(workingDir, "*.png"))
          .then(() => console.log("    TEMP folder cleaned"))
          .catch(console.error);

        const ffmpgCmdLarge = ffmpegCmd(workingPath, stickerPathGifLarge);
        await renderLottie({
          path: stickerPathLottie,
          output: workingPath,
        })
          .then(() => console.log("    Render Complete"))
          .catch(console.error);
        await promiseFromChildProcess(childProcess.exec(ffmpgCmdLarge)).catch(
          console.error
        );
        await rimrafAsync(path.join(workingDir, "*.png"))
          .then(() => console.log("    TEMP folder cleaned"))
          .catch(console.error);
      }
    }
  }
})();
