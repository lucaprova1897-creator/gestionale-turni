# Gestionale Turni

Gestionale orari/turni per dipendenti (sala, cucina, reception, ecc.),
pensato per essere **multi-tenant**: adatto a qualsiasi struttura
ristorativa/alberghiera, non solo a un singolo locale.

## Stack

- **Frontend**: React + Vite, deploy su Netlify
- **Backend**: Supabase (Postgres + Auth + Row Level Security)

## Setup

1. Crea un nuovo progetto Supabase (separato da altri progetti esistenti).
2. Esegui `schema.sql` nell'SQL editor di Supabase.
3. Copia `.env.example` in `.env` e inserisci URL e anon key del progetto Supabase.
4. `npm install`
5. `npm run dev` per sviluppo locale.
6. Collega la repo a Netlify: build command `npm run build`, publish dir `dist`.
   Ricorda di impostare le stesse variabili d'ambiente (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) nelle impostazioni del sito Netlify.

## Primo avvio per una nuova struttura (onboarding)

Non essendoci ancora un wizard di registrazione automatico, per il primo
utilizzo (es. la tua struttura):

1. Crea manualmente una riga in `organizations` (nome, slug, tipo).
2. Registra il primo utente admin tramite Supabase Auth (email/password).
3. Crea manualmente la riga corrispondente in `profiles` con
   `organization_id` e `role = 'owner'`.
4. Da lì in poi, l'owner può gestire reparti, fasce orarie e dipendenti
   direttamente dall'app (una volta costruite le relative schermate admin).

In futuro questo passaggio può diventare un wizard di self-signup.

## Struttura dati (vedi schema.sql)

- `organizations` — ogni struttura è isolata (multi-tenant)
- `departments` — reparti configurabili per struttura (non fissi tipo "sala/cucina")
- `shift_templates` — fasce orarie tipo, personalizzabili per struttura
- `employees` — anagrafica dipendenti
- `profiles` — utenti collegati a Supabase Auth, con ruolo (owner/admin/employee)
- `shifts` — turni assegnati, con stato (scheduled/ferie/permesso/malattia/cancelled)

Row Level Security isola i dati per organizzazione: ogni utente vede solo
i dati della propria struttura.

## Stato attuale del progetto

- ✅ Login (Supabase Auth)
- ✅ Vista calendario settimanale turni, raggruppata per reparto, design moderno
- ✅ Editor turni: orario di inizio (obbligatorio) e fine (facoltativo, per turni "aperti"),
  turni multipli nello stesso giorno per gestire gli spezzati, stati Ferie/Permesso/Malattia
- ✅ Visibilità turni: admin vede tutti, dipendente vede solo i propri
- ✅ Gestione anagrafica dipendenti (CRUD admin)
- ✅ Configurazione reparti (CRUD admin)
- ✅ Ferie e riposi: saldo calcolato automaticamente (mesi trascorsi dalla data di inizio ×
  riposi/mese spettanti, meno le ferie già usate registrate nel calendario)
- ✅ Mance: periodi con importo raccolto per reparto, distribuzione automatica tra i
  dipendenti in base a una quota (divisibile per part-time/ore ridotte)
- ⬜ Configurazione fasce orarie predefinite (shift_templates) — tabella pronta, UI da fare
- ⬜ Wizard di onboarding per nuove strutture (per ora si fa manualmente da Supabase)

## Riuso futuro / collegamento ad altri gestionali

Lo schema `employees`/`departments` è pensato in modo generico proprio per
poter essere collegato in futuro ad altri gestionali (es. gestionale hotel),
senza dover duplicare le anagrafiche — basterà mappare gli ID invece di
reinventare le tabelle.
