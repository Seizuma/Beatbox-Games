export default function getEmoji(name, lastAnswers) {
    const answer = lastAnswers[name];
    if (answer) return answer.isCorrect ? ' ✅' : ' ❌';
    return '';
}
