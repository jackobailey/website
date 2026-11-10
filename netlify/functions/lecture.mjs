import { readFile } from "node:fs/promises";
import { getDeployStore } from "@netlify/blobs";
import { denied, isLecturer, lectureApi } from "../lecture/lecture-api.mjs";

const passwordHash = process.env.POLI10302_LECTURER_HASH || "1166e4ccbb7b60d571df69445a9cda0c13f2bce8952992617113bc412a8b4de2";

export const config = {
  path: ["/poli10302/live/slides.html", "/poli10302/live/api/*"]
};

export default async function lecture(request) {
  if (new URL(request.url).pathname.endsWith("/slides.html")) {
    if (!isLecturer(request, passwordHash)) return denied();
    const slides = await readFile("netlify/lecture/slides.html");
    return new Response(slides, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  }
  const store = getDeployStore({ name: "poli10302-live", consistency: "strong", region: "eu-central-1" });
  return lectureApi(request, store, passwordHash);
}
