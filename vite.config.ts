import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "mock-medias", // Give your plugin a name
      configureServer(server) {
        server.middlewares.use("/api/medias", (req, res, next) => {
          if (req.method !== "GET") return next(); // Pass to next middleware if not a GET request

          const url = new URL(req.originalUrl, `http://${req.headers.host}`);

          const foo = url.searchParams.get("foo");
          console.log("foo", foo);

          const jsonResponse = {
            message: "This is a debug response",
            timestamp: new Date().toISOString(),
          };

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(json));
        });
      },
    },
  ],
});

//
//
//

const per_page = 10;

export const json = {
  page: 1,
  per_page,
  videos: Array.from({ length: per_page }).map((_, i) => {
    return {
      id: 3704911,
      width: 2160,
      height: 4096,
      duration: 85,
      full_res: null,
      tags: [],
      url: "https://www.pexels.com/video/a-couple-in-love-sharing-on-a-plated-pancakes-with-melted-chocolate-toppings-3704911/",
      image:
        "https://images.pexels.com/videos/3704911/14-february-love-3704911.jpeg?auto=compress\u0026cs=tinysrgb\u0026fit=crop\u0026h=1200\u0026w=630",
      avg_color: null,
      user: {
        id: 1437723,
        name: "cottonbro studio",
        url: "https://www.pexels.com/@cottonbro",
      },
      video_files: [
        {
          id: 9319036,
          quality: "sd",
          file_type: "video/mp4",
          width: 338,
          height: 640,
          fps: 25.0,
          link: "https://videos.pexels.com/video-files/3704911/3704911-sd_338_640_25fps.mp4",
          size: 4481665,
        },
        {
          id: 9319503,
          quality: "hd",
          file_type: "video/mp4",
          width: 720,
          height: 1366,
          fps: 50.0,
          link: "https://videos.pexels.com/video-files/3704911/3704911-hd_720_1366_50fps.mp4",
          size: 15200391,
        },
        {
          id: 9319823,
          quality: "uhd",
          file_type: "video/mp4",
          width: 2160,
          height: 4096,
          fps: 25.0,
          link: "https://videos.pexels.com/video-files/3704911/3704911-uhd_2160_4096_25fps.mp4",
          size: 102642548,
        },
        {
          id: 9320279,
          quality: "sd",
          file_type: "video/mp4",
          width: 226,
          height: 426,
          fps: 25.0,
          link: "https://videos.pexels.com/video-files/3704911/3704911-sd_226_426_25fps.mp4",
          size: 2572204,
        },
        {
          id: 9320314,
          quality: "sd",
          file_type: "video/mp4",
          width: 506,
          height: 960,
          fps: 25.0,
          link: "https://videos.pexels.com/video-files/3704911/3704911-sd_506_960_25fps.mp4",
          size: 8080359,
        },
        {
          id: 9320420,
          quality: "hd",
          file_type: "video/mp4",
          width: 1080,
          height: 2048,
          fps: 25.0,
          link: "https://videos.pexels.com/video-files/3704911/3704911-hd_1080_2048_25fps.mp4",
          size: 25305551,
        },
        {
          id: 9320455,
          quality: "uhd",
          file_type: "video/mp4",
          width: 1440,
          height: 2732,
          fps: 25.0,
          link: "https://videos.pexels.com/video-files/3704911/3704911-uhd_1440_2732_25fps.mp4",
          size: 40198913,
        },
      ],
      video_pictures: [
        {
          id: 880197,
          nr: 0,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-0.jpeg",
        },
        {
          id: 880198,
          nr: 1,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-1.jpeg",
        },
        {
          id: 880199,
          nr: 2,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-2.jpeg",
        },
        {
          id: 880200,
          nr: 3,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-3.jpeg",
        },
        {
          id: 880201,
          nr: 4,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-4.jpeg",
        },
        {
          id: 880202,
          nr: 5,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-5.jpeg",
        },
        {
          id: 880203,
          nr: 6,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-6.jpeg",
        },
        {
          id: 880204,
          nr: 7,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-7.jpeg",
        },
        {
          id: 880205,
          nr: 8,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-8.jpeg",
        },
        {
          id: 880206,
          nr: 9,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-9.jpeg",
        },
        {
          id: 880207,
          nr: 10,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-10.jpeg",
        },
        {
          id: 880208,
          nr: 11,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-11.jpeg",
        },
        {
          id: 880209,
          nr: 12,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-12.jpeg",
        },
        {
          id: 880210,
          nr: 13,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-13.jpeg",
        },
        {
          id: 880211,
          nr: 14,
          picture:
            "https://images.pexels.com/videos/3704911/pictures/preview-14.jpeg",
        },
      ],
    };
  }),
  total_results: 2459,
  next_page:
    "https://api.pexels.com/v1/videos/search/?orientation=portrait\u0026page=2\u0026per_page=10\u0026query=romance\u0026size=small",
  url: "https://api-server.pexels.com/search/videos/romance/",
};
