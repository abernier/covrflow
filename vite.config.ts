import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: "mock-pexels", // Give your plugin a name
      configureServer(server) {
        server.middlewares.use("/videos/search", (req, res, next) => {
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
      // id: 3704911,
      // width: 2160,
      // height: 4096,
      // duration: 85,
      // full_res: null,
      // tags: [],
      // url: "https://www.pexels.com/video/a-couple-in-love-sharing-on-a-plated-pancakes-with-melted-chocolate-toppings-3704911/",
      // image: "https://images.pexels.com/videos/3704911/14-february-love-3704911.jpeg?auto=compress\u0026cs=tinysrgb\u0026fit=crop\u0026h=1200\u0026w=630",
      // avg_color: null,
      // user: {
      //   id: 1437723,
      //   name: "cottonbro studio",
      //   url: "https://www.pexels.com/@cottonbro",
      // },
      video_files: [
        {
          // id: 9319036,
          // quality: "sd",
          // file_type: "video/mp4",
          width: 338,
          height: 640,
          // fps: 25.0,
          link: "/3704911-sd_338_640_25fps.mp4",
          // size: 4481665,
        },
      ],
      video_pictures: [
        {
          // id: 880197,
          nr: 0,
          picture: "/3704911-sd_338_640_25fps.jpg",
        },
      ],
    };
  }),
  // total_results: 2459,
  // next_page: "https://api.pexels.com/v1/videos/search/?orientation=portrait\u0026page=2\u0026per_page=10\u0026query=romance\u0026size=small",
  // url: "https://api-server.pexels.com/search/videos/romance/",
};
