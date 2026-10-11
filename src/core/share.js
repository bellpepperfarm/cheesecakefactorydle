export function buildShareText({ title, dateKey, results, maxItemScore, url }) {
    const score = results.reduce((sum, result) => sum + result.score, 0);
    const squares = results.map(result => result.score >= maxItemScore * .9 ? '🟩' : result.score >= maxItemScore * .7 ? '🟨' : result.score >= maxItemScore * .45 ? '🟧' : '🟥').join('');
    return `${title} · Daily ${dateKey}\n${squares}\n${score} / ${results.length * maxItemScore}\n${url}`;
}
