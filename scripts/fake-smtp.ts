/** Tiny in-process SMTP server for tests: captures every message sent to EMAIL_SMTP_URL (default smtp://127.0.0.1:2525). */
import net from "node:net";

const SMTP = new URL(process.env.EMAIL_SMTP_URL ?? "smtp://127.0.0.1:2525");
export const inbox: { to: string; body: string }[] = [];
let server: net.Server | undefined;

export function startSmtp() {
  return new Promise<void>((resolve) => {
    server = net.createServer((sock) => {
      let data = false, buf = "", to = "";
      sock.write("220 test ESMTP\r\n");
      sock.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        if (data) { if (buf.includes("\r\n.\r\n")) { data = false; inbox.push({ to, body: buf }); buf = ""; sock.write("250 queued\r\n"); } return; }
        let i: number;
        while ((i = buf.indexOf("\r\n")) >= 0) {
          const line = buf.slice(0, i); buf = buf.slice(i + 2);
          if (/^EHLO|^HELO/i.test(line)) sock.write("250 test\r\n");
          else if (/^MAIL FROM/i.test(line)) sock.write("250 ok\r\n");
          else if (/^RCPT TO/i.test(line)) { to = /<([^>]+)>/.exec(line)?.[1] ?? ""; sock.write("250 ok\r\n"); }
          else if (/^DATA/i.test(line)) { data = true; sock.write("354 go\r\n"); break; }
          else if (/^QUIT/i.test(line)) { sock.write("221 bye\r\n"); sock.end(); }
          else sock.write("250 ok\r\n");
        }
      });
      sock.on("error", () => {});
    }).listen(Number(SMTP.port), "127.0.0.1", resolve);
  });
}
export const stopSmtp = () => new Promise<void>((r) => (server ? server.close(() => r()) : r()));

/** Quoted-printable safe: soft line breaks may split the link. */
export const decodeQP = (s: string) => s.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
export const waitMail = async (to: string, n = 1) => {
  for (let i = 0; i < 60; i++) { const m = inbox.filter((x) => x.to.toLowerCase() === to.toLowerCase()); if (m.length >= n) return m[n - 1]!; await new Promise((r) => setTimeout(r, 100)); }
  return null;
};
/** Message text with the transfer encoding (base64 for Persian text, or quoted-printable) undone. */
export function textOf(m: { body: string }) {
  const i = m.body.indexOf("\r\n\r\n"); const head = m.body.slice(0, i), body = m.body.slice(i + 4).replace(/\r\n\.\r\n$/, "");
  if (/content-transfer-encoding:\s*base64/i.test(head)) return Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
  return decodeQP(body);
}
export const linkOf = (m: { body: string }) => textOf(m).match(/account\?reset=([A-Za-z0-9_-]{20,})/)?.[1] ?? null;
