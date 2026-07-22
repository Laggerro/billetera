const SUPABASE_URL = 'https://jzzuxigyyeapmcgflrii.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6enV4aWd5eWVhcG1jZ2ZscmlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1OTYxMzYsImV4cCI6MjEwMDE3MjEzNn0.yJyxp0Ep2Nx_hQ3qF3W38RIAcBwEZTf_cH7iFwGuRqM';

// Se asigna correctamente a window._supabase para que index.js lo pueda usar
window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("--> Cliente de Supabase inicializado exitosamente.");