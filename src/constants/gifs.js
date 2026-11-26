// src/constants/gifs.js

export const GIPHY_API_URL = "https://api.giphy.com/v1/gifs";
export const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
export const GIF_PAGE_SIZE = 20;
export const GIF_SEARCH_DELAY = 500;
export const GIF_MAX_QUERY_LENGTH = 50;
export const GIF_RATING = "pg";
export const GIF_ID_PATTERN = /^[a-zA-Z0-9]{1,100}$/;
export const GIF_CATEGORIES = Object.freeze([
  "Trending",
  "Happy",
  "Funny",
  "Reaction",
  "Love",
  "Wow",
  "Sad",
  "Music",
  "Celebrate",
]);