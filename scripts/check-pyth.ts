import { Connection, PublicKey } from "@solana/web3.js";
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const PYTH = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");
(async () => {
  const [info, slot] = await Promise.all([conn.getAccountInfo(PYTH), conn.getSlot("confirmed")]);
  if (!info) { console.log("no account"); return; }
  const d = info.data;
  let o = 8 + 32;
  const tag = d[o]; o += 1;
  if (tag === 0) o += 1;
  // feed_id (32) + price (i64,8) + conf(u64,8) + exp(i32,4) + pub_time(i64,8) + prev_pub_time(i64,8) + ema_price(8) + ema_conf(8) + posted_slot(u64,8)
  const priceOffset = o + 32;
  const postedSlotOffset = o + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 8;
  const price = d.readBigInt64LE(priceOffset);
  const expo = d.readInt32LE(priceOffset + 16);
  const postedSlot = d.readBigUInt64LE(postedSlotOffset);
  console.log(`current_slot=${slot}`);
  console.log(`posted_slot=${postedSlot}  (delta=${BigInt(slot)-postedSlot})`);
  console.log(`price=${price} × 10^${expo}`);
})();
