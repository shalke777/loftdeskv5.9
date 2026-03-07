export const storageService = {
  upload: async (file: File) => ({ path: `uploads/${file.name}` }),
}
