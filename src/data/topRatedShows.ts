import type { ShowSource } from '../types/show';

/** Curated "acclaimed/top rated" TV & anime titles with a hand-entered
 * IMDb rating, used to seed the "Top Rated" browse grid on the Search
 * screen without needing any API calls to build it. These numbers are
 * manually curated, not live-fetched — they can drift from IMDb's
 * actual current rating over time and should be treated as
 * approximate. Order is the display order (highest rating first).
 *
 * `sourceId`/`posterUrl` are hardcoded too — resolved once (see
 * scripts used to build this list) rather than looked up live every
 * time the Search screen opens. If the source ever changes a poster
 * or removes a show, this drifts rather than fetches live; that's an
 * acceptable trade for the grid never firing ~100 searches per
 * session. Tapping a tile still fetches full details as normal (see
 * SearchScreen's handleOpenDetails) — only the browse grid itself is
 * static. */
export interface TopRatedShowEntry {
  title: string;
  imdbRating: string;
  /** The show's first-air year. No longer used to disambiguate a live
   * TMDB search (sourceId is already hardcoded) — kept as accurate
   * metadata, mainly to sharpen the OMDb rating lookup once a tile is
   * tapped and added (see utils/buildTrackedShow). */
  year?: string;
  /** Defaults to 'tmdb' when omitted — only entries that need the
   * AniList-only path (e.g. an arc/season TMDB doesn't index as its
   * own show, like Bleach: Thousand-Year Blood War) set this. */
  source?: ShowSource;
  sourceId: number;
  posterUrl: string;
}

export const TOP_RATED_SHOWS: TopRatedShowEntry[] = [
  { title: 'Breaking Bad', imdbRating: '9.5', year: '2008', sourceId: 1396, posterUrl: 'https://image.tmdb.org/t/p/w200/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg' },
  { title: 'Band of Brothers', imdbRating: '9.4', year: '2001', sourceId: 4613, posterUrl: 'https://image.tmdb.org/t/p/w200/pGzV187ogXzgJrvPRy2YPi29ofH.jpg' },
  { title: 'Chernobyl', imdbRating: '9.3', year: '2019', sourceId: 87108, posterUrl: 'https://image.tmdb.org/t/p/w200/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg' },
  { title: 'The Wire', imdbRating: '9.3', year: '2002', sourceId: 1438, posterUrl: 'https://image.tmdb.org/t/p/w200/4lbclFySvugI51fwsyxBTOm4DqK.jpg' },
  { title: 'Avatar: The Last Airbender', imdbRating: '9.3', year: '2005', sourceId: 246, posterUrl: 'https://image.tmdb.org/t/p/w200/yaGt4GIutpbXHsv48tWceWg6s56.jpg' },
  { title: 'The Sopranos', imdbRating: '9.2', year: '1999', sourceId: 1398, posterUrl: 'https://image.tmdb.org/t/p/w200/rTc7ZXdroqjkKivFPvCPX0Ru7uw.jpg' },
  { title: 'Game of Thrones', imdbRating: '9.2', year: '2011', sourceId: 1399, posterUrl: 'https://image.tmdb.org/t/p/w200/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg' },
  { title: 'Attack on Titan', imdbRating: '9.1', year: '2013', sourceId: 1429, posterUrl: 'https://image.tmdb.org/t/p/w200/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg' },
  { title: 'Fullmetal Alchemist: Brotherhood', imdbRating: '9.1', year: '2009', sourceId: 31911, posterUrl: 'https://image.tmdb.org/t/p/w200/5ZFUEOULaVml7pQuXxhpR2SmVUw.jpg' },
  { title: 'The Chosen', imdbRating: '9.1', year: '2017', sourceId: 85077, posterUrl: 'https://image.tmdb.org/t/p/w200/dqVUFuNrMFWt7uGNWlpo91VKYOI.jpg' },
  { title: 'Rick and Morty', imdbRating: '9.0', year: '2013', sourceId: 60625, posterUrl: 'https://image.tmdb.org/t/p/w200/owhkU6KRqdXoUQpjV8uyZGPtX58.jpg' },
  { title: 'Sherlock', imdbRating: '9.0', year: '2010', sourceId: 19885, posterUrl: 'https://image.tmdb.org/t/p/w200/7WTsnHkbA0FaG6R9twfFde0I9hl.jpg' },
  { title: 'Batman: The Animated Series', imdbRating: '9.0', year: '1992', sourceId: 2098, posterUrl: 'https://image.tmdb.org/t/p/w200/lBomQFW1vlm1yUYMNSbFZ45R4Ox.jpg' },
  { title: 'Better Call Saul', imdbRating: '9.0', year: '2015', sourceId: 60059, posterUrl: 'https://image.tmdb.org/t/p/w200/zjg4jpK1Wp2kiRvtt5ND0kznako.jpg' },
  { title: 'Arcane: League of Legends', imdbRating: '9.0', year: '2021', sourceId: 94605, posterUrl: 'https://image.tmdb.org/t/p/w200/abf8tHznhSvl9BAElD2cQeRr7do.jpg' },
  { title: 'Hunter x Hunter', imdbRating: '9.0', year: '2011', sourceId: 46298, posterUrl: 'https://image.tmdb.org/t/p/w200/i2EEr2uBvRlAwJ8d8zTG2Y19mIa.jpg' },
  { title: 'Dexter: Resurrection', imdbRating: '9.0', year: '2025', sourceId: 259909, posterUrl: 'https://image.tmdb.org/t/p/w200/kEHZfSZhZKDot4wqurgIzMUNq1W.jpg' },
  { title: 'One Piece', imdbRating: '9.0', year: '1999', sourceId: 37854, posterUrl: 'https://image.tmdb.org/t/p/w200/dB4EDhre2dsC2kxYDavyKWqLQwi.jpg' },
  { title: 'Bleach: Thousand-Year Blood War', imdbRating: '9.0', year: '2022', source: 'anilist', sourceId: 41467, posterUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx116674-p3zK4PUX2Aag.jpg' },
  { title: 'The Pitt', imdbRating: '8.9', year: '2025', sourceId: 250307, posterUrl: 'https://image.tmdb.org/t/p/w200/kvFSpESyBZMjaeOJDx7RS3P1jey.jpg' },
  { title: 'Firefly', imdbRating: '8.9', year: '2002', sourceId: 1437, posterUrl: 'https://image.tmdb.org/t/p/w200/vZcKsy4sGAvWMVqLluwYuoi11Kj.jpg' },
  { title: 'Death Note', imdbRating: '8.9', year: '2006', sourceId: 13916, posterUrl: 'https://image.tmdb.org/t/p/w200/tCZFfYTIwrR7n94J6G14Y4hAFU6.jpg' },
  { title: "Frieren: Beyond Journey's End", imdbRating: '8.9', year: '2023', sourceId: 209867, posterUrl: 'https://image.tmdb.org/t/p/w200/dqZENchTd7lp5zht7BdlqM7RBhD.jpg' },
  { title: 'Cowboy Bebop', imdbRating: '8.9', year: '1998', sourceId: 30991, posterUrl: 'https://image.tmdb.org/t/p/w200/xDiXDfZwC6XYC6fxHI1jl3A3Ill.jpg' },
  { title: 'Vinland Saga', imdbRating: '8.9', year: '2019', sourceId: 88803, posterUrl: 'https://image.tmdb.org/t/p/w200/vUHlpA5c1NXkds59reY3HMb4Abs.jpg' },
  { title: 'True Detective', imdbRating: '8.8', year: '2014', sourceId: 46648, posterUrl: 'https://image.tmdb.org/t/p/w200/dC7jkj2g1aU8sxKqM6D4g44xA6w.jpg' },
  { title: 'Fargo', imdbRating: '8.8', year: '2014', sourceId: 60622, posterUrl: 'https://image.tmdb.org/t/p/w200/a3VW6khsyUVKrG0GBCWFG3NzWPX.jpg' },
  { title: 'When They See Us', imdbRating: '8.8', year: '2019', sourceId: 81355, posterUrl: 'https://image.tmdb.org/t/p/w200/oPv3nNtkuc6EPEql5lgdOuQNHuG.jpg' },
  { title: 'Succession', imdbRating: '8.8', year: '2018', sourceId: 76331, posterUrl: 'https://image.tmdb.org/t/p/w200/z0XiwdrCQ9yVIr4O0pxzaAYRxdW.jpg' },
  { title: 'BoJack Horseman', imdbRating: '8.8', year: '2014', sourceId: 61222, posterUrl: 'https://image.tmdb.org/t/p/w200/6JFWzlChcGgLiIUo2COgNlWGFKy.jpg' },
  { title: 'Dragon Ball Z', imdbRating: '8.8', year: '1989', sourceId: 12971, posterUrl: 'https://image.tmdb.org/t/p/w200/yfyToia25GnvjY7FPAGaCm3lKRc.jpg' },
  { title: 'Dragon Ball Z Kai', imdbRating: '8.8', year: '2009', sourceId: 61709, posterUrl: 'https://image.tmdb.org/t/p/w200/ykl67ghR2ug6KGFH3CQcI01pzQJ.jpg' },
  { title: 'Berserk', imdbRating: '8.8', year: '1997', sourceId: 35935, posterUrl: 'https://image.tmdb.org/t/p/w200/xctRBSZzvoHDHz38ZZUGxRYetvG.jpg' },
  { title: 'Steins;Gate', imdbRating: '8.8', year: '2011', sourceId: 42509, posterUrl: 'https://image.tmdb.org/t/p/w200/bj9lZLRey7ZTWNbA9o3L0tW0HfW.jpg' },
  { title: 'Hajime no Ippo', imdbRating: '8.8', year: '2000', sourceId: 42705, posterUrl: 'https://image.tmdb.org/t/p/w200/1LApB9C9kEkh2ZU2vzAhurNDipl.jpg' },
  { title: 'Twin Peaks', imdbRating: '8.7', year: '1990', sourceId: 1920, posterUrl: 'https://image.tmdb.org/t/p/w200/lA9CNSdo50iQPZ8A2fyVpMvJZAf.jpg' },
  { title: 'Narcos', imdbRating: '8.7', year: '2015', sourceId: 63351, posterUrl: 'https://image.tmdb.org/t/p/w200/rTmal9fDbwh5F0waol2hq35U4ah.jpg' },
  { title: 'Ted Lasso', imdbRating: '8.7', year: '2020', sourceId: 97546, posterUrl: 'https://image.tmdb.org/t/p/w200/5fhZdwP1DVJ0FyVH6vrFdHwpXIn.jpg' },
  { title: 'Black Mirror', imdbRating: '8.7', year: '2011', sourceId: 42009, posterUrl: 'https://image.tmdb.org/t/p/w200/seN6rRfN0I6n8iDXjlSMk1QjNcq.jpg' },
  { title: 'Peaky Blinders', imdbRating: '8.7', year: '2013', sourceId: 60574, posterUrl: 'https://image.tmdb.org/t/p/w200/vUUqzWa2LnHIVqkaKVlVGkVcZIW.jpg' },
  { title: 'Six Feet Under', imdbRating: '8.7', year: '2001', sourceId: 1274, posterUrl: 'https://image.tmdb.org/t/p/w200/sCgzLaVlFy8KxtxRPvt1V5MNTDb.jpg' },
  { title: 'Rome', imdbRating: '8.7', year: '2005', sourceId: 1891, posterUrl: 'https://image.tmdb.org/t/p/w200/1A1BwgWO3Sw379VEhR0vkTuE3XW.jpg' },
  { title: 'Dark', imdbRating: '8.7', year: '2017', sourceId: 70523, posterUrl: 'https://image.tmdb.org/t/p/w200/apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg' },
  { title: 'Oz', imdbRating: '8.7', year: '1997', sourceId: 3322, posterUrl: 'https://image.tmdb.org/t/p/w200/oTQ9PUnCgf9CimYeWuDGp8iaT07.jpg' },
  { title: 'Monster', imdbRating: '8.7', year: '2004', sourceId: 30981, posterUrl: 'https://image.tmdb.org/t/p/w200/n5XNKXnoXpoXyfiCtXHOf8q8PFM.jpg' },
  { title: "X-Men '97", imdbRating: '8.7', year: '2024', sourceId: 138502, posterUrl: 'https://image.tmdb.org/t/p/w200/2HKBc5UiFw8JrruHq8S1Y7TnlW0.jpg' },
  { title: 'Naruto: Shippuden', imdbRating: '8.7', year: '2007', sourceId: 31910, posterUrl: 'https://image.tmdb.org/t/p/w200/kV27j3Nz4d5z8u6mN3EJw9RiLg2.jpg' },
  { title: 'Invincible', imdbRating: '8.7', year: '2021', sourceId: 95557, posterUrl: 'https://image.tmdb.org/t/p/w200/4tblBrslcKSifMVZ3TmtT2ukMor.jpg' },
  { title: 'The Shield', imdbRating: '8.7', year: '2002', sourceId: 1414, posterUrl: 'https://image.tmdb.org/t/p/w200/AfdZXqqlFsPUEfi6kWWWthxw7Nz.jpg' },
  { title: 'Fleabag', imdbRating: '8.7', year: '2016', sourceId: 67070, posterUrl: 'https://image.tmdb.org/t/p/w200/27vEYsRKa3eAniwmoccOoluEXQ1.jpg' },
  { title: 'Battlestar Galactica', imdbRating: '8.7', year: '2004', sourceId: 1972, posterUrl: 'https://image.tmdb.org/t/p/w200/99PJSbcO2LeM10uOGWeFihNp77j.jpg' },
  { title: 'Star Trek: The Next Generation', imdbRating: '8.7', year: '1987', sourceId: 655, posterUrl: 'https://image.tmdb.org/t/p/w200/vkLzXddgUKH5VcpnYiRzpJFrZhz.jpg' },
  { title: 'Mad Men', imdbRating: '8.7', year: '2007', sourceId: 1104, posterUrl: 'https://image.tmdb.org/t/p/w200/7v8iCNzKFpdlrCMcqCoJyn74Nsa.jpg' },
  { title: 'Blue Eye Samurai', imdbRating: '8.7', year: '2023', sourceId: 225180, posterUrl: 'https://image.tmdb.org/t/p/w200/fXm3JT4WLQVnwukdvghtAblc1wc.jpg' },
  { title: 'House M.D.', imdbRating: '8.7', year: '2004', sourceId: 1408, posterUrl: 'https://image.tmdb.org/t/p/w200/3Cz7ySOQJmqiuTdrc6CY0r65yDI.jpg' },
  { title: 'Justice League Unlimited', imdbRating: '8.7', year: '2004', sourceId: 84200, posterUrl: 'https://image.tmdb.org/t/p/w200/vRRvCUREeqqnp3hHdqep83eQjdP.jpg' },
  { title: 'The Adventures of Sherlock Holmes', imdbRating: '8.7', year: '1984', sourceId: 297950, posterUrl: 'https://image.tmdb.org/t/p/w200/j9oAQVIIU8KvkKAchveTAplkN5I.jpg' },
  { title: 'Line of Duty', imdbRating: '8.7', year: '2012', sourceId: 43982, posterUrl: 'https://image.tmdb.org/t/p/w200/pBAp7VfKVQKQIiLRJHZSMGtyXAB.jpg' },
  { title: 'Code Geass: Lelouch of the Rebellion', imdbRating: '8.7', year: '2006', sourceId: 31724, posterUrl: 'https://image.tmdb.org/t/p/w200/x316WCogkeIwNY4JR8zTCHbI2nQ.jpg' },
  { title: 'Friday Night Lights', imdbRating: '8.7', year: '2006', sourceId: 4278, posterUrl: 'https://image.tmdb.org/t/p/w200/Eu7MzZY1DldJ683z7vLkILHNRD.jpg' },
  { title: 'This Is Us', imdbRating: '8.7', year: '2016', sourceId: 67136, posterUrl: 'https://image.tmdb.org/t/p/w200/huxmY6Dmzwpv5Q2hnNft0UMK7vf.jpg' },
  { title: 'Adventure Time', imdbRating: '8.7', year: '2010', sourceId: 15260, posterUrl: 'https://image.tmdb.org/t/p/w200/qk3eQ8jW4opJ48gFWYUXWaMT4l.jpg' },
  { title: 'Haikyu!!', imdbRating: '8.7', year: '2014', sourceId: 60863, posterUrl: 'https://image.tmdb.org/t/p/w200/8WEr48swcqe89Zsy5sdrGCASlIg.jpg' },
  { title: 'The Bureau', imdbRating: '8.7', year: '2015', sourceId: 62476, posterUrl: 'https://image.tmdb.org/t/p/w200/pWd0ajqIsd92tcQEgYBC7nMpOrk.jpg' },
  { title: 'The Return of Sherlock Holmes', imdbRating: '8.7', year: '1986', sourceId: 325386, posterUrl: 'https://image.tmdb.org/t/p/w200/8e7138u8kAhvGB9truCWRr6aCZo.jpg' },
  { title: 'Heated Rivalry', imdbRating: '8.7', year: '2024', sourceId: 301507, posterUrl: 'https://image.tmdb.org/t/p/w200/3YCKbtAkYWCMDLHvkUjGhG7eWoS.jpg' },
  { title: 'Homicide: Life on the Street', imdbRating: '8.7', year: '1993', sourceId: 4464, posterUrl: 'https://image.tmdb.org/t/p/w200/nb5310xlFjx5r9TnpKoaOTQsAlP.jpg' },
  { title: "Takopi's Original Sin", imdbRating: '8.7', year: '2025', sourceId: 284445, posterUrl: 'https://image.tmdb.org/t/p/w200/xPXDVhVKt0XM34ihoUVMHtLYTw8.jpg' },
  { title: 'Gintama', imdbRating: '8.7', year: '2006', sourceId: 57041, posterUrl: 'https://image.tmdb.org/t/p/w200/f7vK8pzZIqhyA8sYmBpWmp9Ae7.jpg' },
  { title: 'Severance', imdbRating: '8.6', year: '2022', sourceId: 95396, posterUrl: 'https://image.tmdb.org/t/p/w200/pPHpeI2X1qEd1CS1SeyrdhZ4qnT.jpg' },
  { title: 'The Marvelous Mrs. Maisel', imdbRating: '8.6', year: '2017', sourceId: 70796, posterUrl: 'https://image.tmdb.org/t/p/w200/zS7fQiOZiKCVH2vlYSiIsFWW8hh.jpg' },
  { title: 'Dexter', imdbRating: '8.6', year: '2006', sourceId: 1405, posterUrl: 'https://image.tmdb.org/t/p/w200/q8dWfc4JwQuv3HayIZeO84jAXED.jpg' },
  { title: 'The X-Files', imdbRating: '8.6', year: '1993', sourceId: 4087, posterUrl: 'https://image.tmdb.org/t/p/w200/rcBx0p8h51LHceyhquYMxbspJQu.jpg' },
  { title: '1883', imdbRating: '8.6', year: '2021', sourceId: 118357, posterUrl: 'https://image.tmdb.org/t/p/w200/waLbm384SQDwLTCn6ttPqQS5kfV.jpg' },
  { title: 'Poirot', imdbRating: '8.6', year: '1989', sourceId: 790, posterUrl: 'https://image.tmdb.org/t/p/w200/6f4IVfbn8knb7RjdZlGLuW5guDc.jpg' },
  { title: 'Deadwood', imdbRating: '8.6', year: '2004', sourceId: 1406, posterUrl: 'https://image.tmdb.org/t/p/w200/fWwxYAuqY4Na7fKI3Qq2nFWCwG8.jpg' },
  { title: 'A Knight of the Seven Kingdoms', imdbRating: '8.6', year: '2025', sourceId: 224372, posterUrl: 'https://image.tmdb.org/t/p/w200/k8yARbD9iYn2nRX2HvsopfKDN2r.jpg' },
  { title: 'Atlanta', imdbRating: '8.6', year: '2016', sourceId: 65495, posterUrl: 'https://image.tmdb.org/t/p/w200/8HZyGMnPLVVb00rmrh6A2SbK9NX.jpg' },
  { title: 'The Crown', imdbRating: '8.6', year: '2016', sourceId: 65494, posterUrl: 'https://image.tmdb.org/t/p/w200/1M876KPjulVwppEpldhdc8V4o68.jpg' },
  { title: 'Daredevil', imdbRating: '8.6', year: '2015', sourceId: 61889, posterUrl: 'https://image.tmdb.org/t/p/w200/QWbPaDxiB6LW2LjASknzYBvjMj.jpg' },
  { title: 'Bron/Broen', imdbRating: '8.6', year: '2011', sourceId: 45016, posterUrl: 'https://image.tmdb.org/t/p/w200/v8V9hLWArWhoIdmZ1ujmWrJZL6J.jpg' },
  { title: 'House of Cards', imdbRating: '8.6', year: '2013', sourceId: 1425, posterUrl: 'https://image.tmdb.org/t/p/w200/hKWxWjFwnMvkWQawbhvC0Y7ygQ8.jpg' },
  { title: "It's a Sin", imdbRating: '8.6', year: '2021', sourceId: 116174, posterUrl: 'https://image.tmdb.org/t/p/w200/tUaNS4b5TIiP1SwpHCYCbUoGpHG.jpg' },
  { title: 'Mindhunter', imdbRating: '8.6', year: '2017', sourceId: 67744, posterUrl: 'https://image.tmdb.org/t/p/w200/fbKE87mojpIETWepSbD5Qt741fp.jpg' },
  { title: 'Lonesome Dove', imdbRating: '8.6', year: '1989', sourceId: 41692, posterUrl: 'https://image.tmdb.org/t/p/w200/qK4iseZGf0YhYx53ecawSGhL0sl.jpg' },
  { title: 'Primal', imdbRating: '8.6', year: '2019', sourceId: 89456, posterUrl: 'https://image.tmdb.org/t/p/w200/mf12pRakr3eYdJtv6klQtoznnbU.jpg' },
  { title: 'The Mandalorian', imdbRating: '8.6', year: '2019', sourceId: 82856, posterUrl: 'https://image.tmdb.org/t/p/w200/sWgBv7LV2PRoQgkxwlibdGXKz1S.jpg' },
  { title: 'One Punch Man', imdbRating: '8.6', year: '2015', sourceId: 63926, posterUrl: 'https://image.tmdb.org/t/p/w200/dT10AxJIXVvRwFAew4tt2RhzJrD.jpg' },
  { title: 'Shogun', imdbRating: '8.6', year: '2024', sourceId: 126308, posterUrl: 'https://image.tmdb.org/t/p/w200/7O4iVfOMQmdCSxhOg1WnzG1AgYT.jpg' },
  { title: 'The Offer', imdbRating: '8.6', year: '2022', sourceId: 114068, posterUrl: 'https://image.tmdb.org/t/p/w200/9fdYX5uc3HZEuYotms3XJ72AbCr.jpg' },
  { title: 'Andor', imdbRating: '8.6', year: '2022', sourceId: 83867, posterUrl: 'https://image.tmdb.org/t/p/w200/khZqmwHQicTYoS7Flreb9EddFZC.jpg' },
  { title: 'Pose', imdbRating: '8.6', year: '2018', sourceId: 79084, posterUrl: 'https://image.tmdb.org/t/p/w200/5f23i30nFJz0nrd3DGheOCqXa2P.jpg' },
  { title: 'Gomorra', imdbRating: '8.6', year: '2014', sourceId: 61068, posterUrl: 'https://image.tmdb.org/t/p/w200/cXsagSyQQki9vTbV3TTxRCGIIlQ.jpg' },
  { title: 'The Penguin', imdbRating: '8.6', year: '2024', sourceId: 194764, posterUrl: 'https://image.tmdb.org/t/p/w200/vOWcqC4oDQws1doDWLO7d3dh5qc.jpg' },
  { title: 'The Newsroom', imdbRating: '8.6', year: '2012', sourceId: 15621, posterUrl: 'https://image.tmdb.org/t/p/w200/pOC3DmU47X98Sv5vaPnmgjG30eY.jpg' },
  { title: 'Stranger Things', imdbRating: '8.6', year: '2016', sourceId: 66732, posterUrl: 'https://image.tmdb.org/t/p/w200/uOOtwVbSr4QDjAGIifLDwpb2Pdl.jpg' },
  { title: 'Archer', imdbRating: '8.6', year: '2009', sourceId: 10283, posterUrl: 'https://image.tmdb.org/t/p/w200/vhnrkTGYPqcB63ALcSJm0WoaKHT.jpg' },
  { title: 'Scavengers Reign', imdbRating: '8.6', year: '2023', sourceId: 204154, posterUrl: 'https://image.tmdb.org/t/p/w200/bFlVZV8TQbs8hcIY7PVYonYFMgK.jpg' },
  { title: 'Dopesick', imdbRating: '8.6', year: '2021', sourceId: 110695, posterUrl: 'https://image.tmdb.org/t/p/w200/qW8Gpddy29faTcD7VuyKjwLXbKU.jpg' },
  { title: 'Mystery Science Theater 3000', imdbRating: '8.6', year: '1988', sourceId: 1952, posterUrl: 'https://image.tmdb.org/t/p/w200/nNeb35RFoeLwxu0CFzZ9NAI5UTA.jpg' },
  { title: 'Justified', imdbRating: '8.6', year: '2010', sourceId: 1436, posterUrl: 'https://image.tmdb.org/t/p/w200/ie1quhMk09lDtvtAyQAHTu09R9Z.jpg' },
  { title: 'Endeavour', imdbRating: '8.6', year: '2012', sourceId: 44264, posterUrl: 'https://image.tmdb.org/t/p/w200/suX3F5e8XN9emrb52CQSwt2mRwx.jpg' },
];
