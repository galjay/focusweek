# 音频素材来源

项目中的环境音素材均下载到 `public/audio/`，用于本地循环播放。前三个素材来自 Wikimedia Commons；海浪素材来自 YouTube 视频，视频描述明确写明可自由使用，项目保留原视频链接和上传者信息。

| 项目选项 | 本地文件 | 来源 | 授权 |
| --- | --- | --- | --- |
| 雨声 | `public/audio/rain.ogg` | [Rain against the window](https://commons.wikimedia.org/wiki/File:Rain_against_the_window.ogg) | Public domain；作者 cori |
| 咖啡馆 | `public/audio/cafe.ogg` | [Cafe ambiance](https://commons.wikimedia.org/wiki/File:Cafe_ambiance.ogg) | CC0 1.0；作者 Marble Toast |
| 森林 | `public/audio/forest.ogg` | [20090610 0 ambience](https://commons.wikimedia.org/wiki/File:20090610_0_ambience.ogg) | Public domain；作者 nille |
| 海浪 | `public/audio/waves.ogg` | [Ocean waves sound effect (no copyright) FX](https://www.youtube.com/watch?v=cBWjhcGWVtY) | 依据视频描述使用；上传者 Content Creator Sounds |

文件在应用中以 OGG 格式循环播放，不需要运行时请求第三方音频地址。这样部署到 GitHub Pages 后，断网也可以使用已经缓存或随站点发布的音频资源。
