import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(4);
Config.setChromiumOpenGlRenderer("angle");
// Higher quality encode for a client-facing demo.
Config.setCrf(18);
