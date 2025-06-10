let currentPodcastInfo = null;
let isLoading = false;

document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const podUrl = urlParams.get("podurl");
  const playUrl = urlParams.get("play");

  if (podUrl) {
    document.getElementById("podUrlInput").value = podUrl;
    loadPodcastList();
  }

  if (playUrl) {
    playEpisode(playUrl);
  }
});

// 前端 JavaScript 更新
// 更新后的加载函数
async function loadPodcastList() {
  const podUrl = document.getElementById("podUrlInput").value;
  if (!podUrl) {
    alert("Please Enter Valid RSS URL");
    return;
  }

  const episodeList = document.getElementById("episodeList");
  episodeList.innerHTML = "";

  const loadingItem = document.createElement("li");
  loadingItem.innerHTML = `<div class="loading-spinner"></div> Loading episodes...`;
  loadingItem.style.textAlign = "center";
  episodeList.appendChild(loadingItem);

  try {
    const response = await fetch(podUrl);
    const xmlText = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");

    const channel = xml.querySelector("channel");
    const title = channel.querySelector("title")?.textContent || "Untitled";
    const author = channel.querySelector("itunes\\:author")?.textContent || "Unknown Author";
    const image = channel.querySelector("itunes\\:image")?.getAttribute("href") ||
                  channel.querySelector("image > url")?.textContent ||
                  "https://cdn.glitch.global/d1d3f23a-e9d5-45e6-ba0d-86c24c7f4deb/placeholder.png?v=1741660876805";
    const description = channel.querySelector("description")?.textContent || "No description";

   const items = Array.from(channel.getElementsByTagName("item")).map(item => {
  const getText = (tag) => item.getElementsByTagName(tag)[0]?.textContent?.trim() || "";
  const getAttr = (tag, attr) => item.getElementsByTagName(tag)[0]?.getAttribute(attr) || "";

  return {
    title: getText("title") || "No Title",
    audioUrl: getAttr("enclosure", "url"),
    pubDate: getText("pubDate"),
    duration: formatPodcastDuration(getText("itunes:duration") || "0")
  };
});


    try {
      episodeList.innerHTML = "";
      document.getElementById("searchDiv").outerHTML = "";
    } catch {}

    // 播客信息展示
    const podcastInfo = document.getElementById("podcastInfo");
    podcastInfo.style.display = "flex";
    document.getElementById("podcastCover").src = encodeURI(image);
    document.getElementById("podcastTitle").textContent = title;
    document.getElementById("podcastAuthor").textContent = `by ${author}`;
    document.getElementById("podcastDesc").textContent = description;

    document.body.style.backgroundImage = `url('${encodeURI(image)}')`;
    document.body.style.setProperty("--overlay-opacity", "1");

    currentPodcastInfo = { author, title, cover: encodeURI(image) };

    const list = document.getElementById("episodeList");
    list.innerHTML = items.map((ep) => {
      const safeTitle = escapeHTML(ep.title);
      const safeUrl = encodeURIComponent(ep.audioUrl);
      return `
        <li data-url="${safeUrl}" data-title="${safeTitle}">
          <span class="episode-title">${ep.title}</span>
          <div class="episode-meta">
            <span class="duration">${ep.duration}</span>
            <span class="pub-date">${formatDate(ep.pubDate)}</span>
          </div>
        </li>`;
    }).join("");

    list.querySelectorAll("li").forEach((li) => {
      li.addEventListener("click", () => {
        const url = decodeURIComponent(li.dataset.url);
        const title = new DOMParser().parseFromString(
          li.dataset.title,
          "text/html"
        ).body.textContent;
        playEpisode(url, title);
      });
    });

  } catch (error) {
    console.error("Error:", error);
    episodeList.innerHTML = "";
    alert("Failed to load podcast.\n\nProbably RSS does not support CORS");
  }
}

function formatPodcastDuration(duration) {
  if (!duration) return "00:00";

  // Remove whitespace and trim
  duration = duration.trim();

  // If it's already in HH:MM:SS or MM:SS format
  if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(duration)) {
    const parts = duration.split(":").map(Number);
    while (parts.length < 3) parts.unshift(0); // Ensure HH:MM:SS
    const [h, m, s] = parts;
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  // If it's a number (assume seconds)
  const seconds = parseInt(duration, 10);
  if (!isNaN(seconds)) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  return "00:00"; // fallback
}

function pad(num) {
  return num.toString().padStart(2, "0");
}


// 新增HTML转义函数
const escapeHTML = (str) => {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

// 图片加载失败处理
document.getElementById("podcastCover").onerror = function () {
  this.src = "/default-cover.jpg";
};

// 更新播放函数
function playEpisode(url, title) {
  const player = document.getElementById("player");
  const currentEpisodeTitle = document.getElementById("currentEpisodeTitle");

  try {
    // 安全验证URL
    if (!isValidUrl(url)) {
      throw new Error("Invalid audio URL");
    }

    player.src = url;
    //Then is using system control to support showing image/title/arthur
    player.play().then(() => {
      if (currentPodcastInfo && "mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title,
          artist: currentPodcastInfo.author,
          album: currentPodcastInfo.title,
          artwork: generateArtworkArray(currentPodcastInfo.cover),
        });
      }
    });
    currentEpisodeTitle.textContent = title || "Playing...";

    // 添加播放控制（可选）
    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        player.currentTime = Math.max(0, player.currentTime - 10);
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        player.currentTime = Math.min(player.duration, player.currentTime + 10);
      });
    }
  } catch (error) {
    console.error("Playback error:", error);
    alert("Error playing episode");
  }
}

// URL验证函数
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/* 快进 30 秒 */
function seekForward() {
  const player = document.getElementById("player");
  player.currentTime = Math.min(player.duration, player.currentTime + 30);
}

/* 快退 10 秒 */
function seekBackward() {
  const player = document.getElementById("player");
  player.currentTime = Math.max(0, player.currentTime - 10);
}

// 添加日期格式化辅助函数
function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

//System media player support

// 生成符合标准的封面数组
function generateArtworkArray(coverUrl) {
  const sizes = [96, 128, 192, 256, 384, 512];
  return sizes.map((size) => ({
    src: `${coverUrl}?size=${size}`, // 假设图片服务支持尺寸参数
    sizes: `${size}x${size}`,
    type: "image/jpeg",
  }));
}

async function searchPodcasts() {
  const query = document.getElementById("searchInput").value.trim();
  if (!query) return;

  const url = `https://itunes.apple.com/search?entity=podcast&limit=10&term=${encodeURIComponent(
    query
  )}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    displaySearchResults(data.results);
  } catch (error) {
    console.error("Search failed:", error);
  }
}

function displaySearchResults(podcasts) {
  const resultsContainer = document.getElementById("searchResults");
  resultsContainer.innerHTML = "";

  podcasts.forEach((podcast) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <img src="${podcast.artworkUrl100}" alt="${podcast.collectionName}" />
      <span>${podcast.collectionName}</span>
    `;
    li.onclick = () => selectPodcast(podcast.feedUrl);
    resultsContainer.appendChild(li);
  });
}

function selectPodcast(feedUrl) {
  document.getElementById("podUrlInput").value = feedUrl;
  loadPodcastList(); // 触发加载播客
}

// Enter to search
function handleSearchEnter(event) {
  if (event.key === "Enter") {
    searchPodcasts();
  }
}

function handleRSSURLEnter(event) {
  if (event.key === "Enter") {
    loadPodcastList();
  }
}
