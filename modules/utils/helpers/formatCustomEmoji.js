function formatCustomEmoji(emoji) {
  return emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`;
}
module.exports = { formatCustomEmoji };
