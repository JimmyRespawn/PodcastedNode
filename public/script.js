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
function loadPodcastList() {
  const podUrl = document.getElementById("podUrlInput").value;
  if (!podUrl) {
    alert("Please Enter Valid RSS URL");
    return;
  }

  const episodeList = document.getElementById("episodeList");
  // **1. 立即清空列表**
  episodeList.innerHTML = "";

  // **2. 添加加载动画**
  const loadingItem = document.createElement("li");
  loadingItem.innerHTML = `<div class="loading-spinner"></div> Loading episodes...`;
  loadingItem.style.textAlign = "center";
  episodeList.appendChild(loadingItem);

  // load xml list
  fetch(`/feed?podurl=${encodeURIComponent(podUrl)}`)
    .then((response) => response.json())
    .then((data) => {
      const { title, author, image, description, episodes } = data;
      const podcastInfo = document.getElementById("podcastInfo");

    try{
      // **4. 清除加载动画**
      episodeList.innerHTML = "";
      document.getElementById("searchDiv").outerHTML = ""; //输入框
    }catch{
      
    }

      // 显示播客信息（安全处理）
      podcastInfo.style.display = "flex";
      document.getElementById("podcastCover").src = encodeURI(image); // URL编码图片地址
      document.getElementById("podcastTitle").textContent = title;
      document.getElementById("podcastAuthor").textContent = `by ${author}`;
      document.getElementById("podcastDesc").textContent = description;

      // **更新背景图片**
      document.body.style.backgroundImage = `url('${encodeURI(image)}')`;
      // 显示黑色蒙层
      document.body.style.setProperty("--overlay-opacity", "1");

      //为了系统级播放器用
      currentPodcastInfo = {
        author: author,
        title: title,
        cover: encodeURI(image),
      };

      // 安全生成列表项
      const list = document.getElementById("episodeList");
      list.innerHTML = episodes
        .map((ep) => {
          const safeTitle = escapeHTML(ep.title);
          const safeUrl = encodeURIComponent(ep.audioUrl); // 双重编码URL

          return `
          <li data-url="${safeUrl}" data-title="${safeTitle}">
            <span class="episode-title">${ep.title}</span>
            <div class="episode-meta">
              <span class="duration">${ep.duration}</span>
              <span class="pub-date">${formatDate(ep.pubDate)}</span>
            </div>
          </li>
        `;
        })
        .join("");

      // 安全事件绑定（推荐方式）
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
    })
    .catch((error) => {
      console.error("Error:", error);
      episodeList.innerHTML = "";
      alert("Failed to load podcast");
    });
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
