export const aiService = {
  async summarize(text: string) {
    return `Podsumowanie: ${text.slice(0, 120)}`
  },
}
