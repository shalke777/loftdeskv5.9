# Migration notes

1. v3 izolowało dane po `user_id`; v4.2 przygotowuje kierunek `company_id` + role.
2. Oryginalny monolit został zachowany w `legacy/v3/`.
3. Portal klienta ma poprawioną funkcję POST w `netlify/functions/portal-message.js`.
4. Dane demo zostały przebudowane tak, aby odzwierciedlać stare rekordy demo z `App.jsx`.
