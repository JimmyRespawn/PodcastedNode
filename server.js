const express = require('express');
const axios = require("axios"); // Retriving Podcast data
const xml2js = require("xml2js"); // Parsing RSS

const app = express();
const port = 3000;

app.use(express.static("public"));

// 获取播客 RSS 并解析单集
// Retrieve RSS and parse episodes
app.get("/feed", async (req, res) => {
  const podUrl = req.query.podurl;
  if (!podUrl) {
    return res.status(400).send("Missing podurl");
  }

  try {
    const response = await axios.get(podUrl);
    const result = await xml2js.parseStringPromise(response.data);
    
    const channel = result.rss.channel[0];
    // 解析播客元数据
    const podcastMeta = {
      title: channel.title[0],
      author: channel["itunes:author"]?.[0] || "Unknown Author",
      image: channel.image?.[0]?.url?.[0] || 
            channel["itunes:image"]?.[0]?.$.href ||
            "https://cdn.glitch.global/d1d3f23a-e9d5-45e6-ba0d-86c24c7f4deb/placeholder.png?v=1741660876805",
      description: channel.description?.[0] || "No description available"
    };
    
    // 解析单集列表
    const episodes = channel.item.map(item => ({
      title: item.title[0],
      audioUrl: item.enclosure[0].$.url,
      pubDate: item.pubDate?.[0] || "",
      duration: formatPodcastDuration(item["itunes:duration"]?.[0] || 0)
    }));
    //res.json(episodes);
     res.json({ ...podcastMeta, episodes });
  } catch (error) {
    res.status(500).send("Failed to fetch podcast feed");
  }
});

function formatPodcastDuration(duration) {
  let totalSeconds = 0;

  try {
    if (typeof duration === 'string') {
      // 处理带冒号的格式 (HH:MM:SS / MM:SS / SS)
      if (duration.includes(':')) {
        const parts = duration.split(':').reverse(); // 反转数组方便处理
        totalSeconds = parts.reduce((acc, part, index) => {
          return acc + (parseInt(part) || 0) * Math.pow(60, index)
        }, 0);
      } else {
        // 纯数字字符串
        totalSeconds = parseInt(duration) || 0
      }
    } else if (typeof duration === 'number') {
      totalSeconds = duration
    }
  } catch (e) {
    console.error('Duration parse error:', e)
  }

  // 转换为标准化格式
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = n => n.toString().padStart(2, '0')
  
  return hours > 0 
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`
}

// Directly return episodes URL
// 直接返回单集音频地址
app.get("/podcast", (req, res) => {
  const episodeUrl = req.query.episodeurl;
  if (!episodeUrl) {
    return res.status(400).send("Missing episodeurl");
  }
  res.json({ audioUrl: episodeUrl });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});