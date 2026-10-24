#! /usr/bin/env node

import meow from "meow";
import fch from "fch";
import * as cheerio from "cheerio";
import getStdin from "get-stdin";
import nocolor from "nocolor";
import { performance } from "node:perf_hooks";

import Queue from "./queue.js";

const find_links = (html, url) => {
  const $ = cheerio.load(html);
  const links = [];

  $("a").each(function(i, link) {
    const href = $(link).attr("href");
    if (!href) return;
    if (href.startsWith("mailto:")) return;
    if (/^https?:/.test(href)) {
      // Only if it's a part of it
      if (url === href.slice(0, url.length)) {
        links.push(href);
      }
      // Absolute paths; join them with the base URL
    } else if (href.startsWith("/")) {
      const base = url
        .split("/")
        .slice(0, 3)
        .join("/");
      links.push(base.replace(/\/$/, "") + href);
      // Relative paths; join them with the base URL
    } else {
      links.push(url.replace(/\/$/, "") + "/" + href.replace(/^\.\//, ""));
    }
  });
  return links
    .map(link => link.split("#").shift())
    .map(link => link.replace(/\/$/, ""));
};

const queue = new Queue(async (url, queue) => {
  const start = performance.now();
  try {
    const { body: text, status } = await fch(url, { output: "response" });
    const links = find_links(text, url);
    queue.add(...links);
    const time = Math.round(performance.now() - start);
    return { url, text, links, status, time };
  } catch (error) {
    const status = error.response?.status ?? error.cause?.code ?? error.code;
    const time = Math.round(performance.now() - start);
    return { url, text: "", links: [], error, status, time };
  }
});

const cli = meow(
  `
Usage
  $ check-my-links <url>

Options
  --links, -l   Show on the scraper what new links are added in a given page
  --plain, -p   No headers or URL are shown, only the results

Examples
  $ check-my-links francisco.io
  $ check-my-links francisco.io --links
  $ echo "francisco.io" | check-my-links --plain | grep 404
`,
  {
    importMeta: import.meta,
    flags: {
      links: {
        type: "boolean",
        shortFlag: "l"
      },
      plain: {
        type: "boolean",
        shortFlag: "p"
      }
    }
  }
);

(async () => {
  let domain = cli.input[0];
  if (!domain) {
    domain = await getStdin();
  }
  domain = domain.trim().replace(/\/$/, "");
  // Default to HTTPS if no protocol is given. To force e.g. localhost:3000, you
  // can pass `http://localhost:3000/` as the url to scrape
  const base = /^https?:\/\//.test(domain) ? domain : "https://" + domain;
  const isPlain = cli.flags.plain;
  if (!isPlain) {
    console.log(nocolor("{bright}") + base + nocolor("{/}") + " 🔎");
    console.log(`Status\tTime\tFound\tPath`);
  }
  for await (let { url, status, time, links, error } of queue.start(base)) {
    const color = isPlain ? "" : nocolor(error ? "{bgred}" : "{bggreen}");
    const gray = isPlain ? "" : nocolor("{dim}");
    const clear = isPlain ? "" : nocolor("{/}");
    const space = isPlain ? "" : " ";
    const statusOut = `${color}${space}${status}${space}${clear}`;
    const timeOut = `${gray}${time / 1000}s${clear}`;
    const linksOut = `${gray}+${links.length}${clear}`;
    const pathOut = url.replace(/^https?:\/\//, "").replace(domain, "") || "/";
    console.log(`${statusOut}\t${timeOut}\t${linksOut}\t${pathOut}`);
    if (cli.flags.links) {
      links.sort().forEach(url => {
        const path = url.replace(/^https?:\/\//, "").replace(domain, "") || "/";
        console.log(`${gray}${path}${clear}`);
      });
    }
  }
})();
