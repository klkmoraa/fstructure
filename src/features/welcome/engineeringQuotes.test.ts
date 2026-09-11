import { describe, expect, it } from 'vitest';
import {
  ENGINEERING_QUOTES,
  getQuoteById,
  getRandomQuote,
} from './engineeringQuotes';

describe('engineeringQuotes dataset', () => {
  it('contains exactly 200 authentic quotes on engineering, simplicity, art, and life', () => {
    expect(ENGINEERING_QUOTES.length).toBe(200);
  });

  it('has continuous unique IDs from 1 to 200', () => {
    const ids = ENGINEERING_QUOTES.map((q) => q.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(200);

    for (let i = 1; i <= 200; i++) {
      expect(uniqueIds.has(i)).toBe(true);
    }
  });

  it('ensures every quote has complete Spanish and English text and roles', () => {
    const validCategories = [
      'structural',
      'engineering',
      'simplicity',
      'life',
      'art',
      'architecture',
      'software',
      'philosophy',
    ];

    for (const quote of ENGINEERING_QUOTES) {
      expect(quote.author.trim().length).toBeGreaterThan(0);
      expect(quote.text.es.trim().length).toBeGreaterThan(10);
      expect(quote.text.en.trim().length).toBeGreaterThan(10);
      expect(quote.role.es.trim().length).toBeGreaterThan(0);
      expect(quote.role.en.trim().length).toBeGreaterThan(0);
      expect(validCategories).toContain(quote.category);
    }
  });

  it('includes the Steve Jobs quote requested by the user', () => {
    const jobsQuote = getQuoteById(1);
    expect(jobsQuote).toBeDefined();
    expect(jobsQuote?.author).toBe('Steve Jobs');
    expect(jobsQuote?.text.es).toContain('Hacer algo simple es más difícil que hacerlo complejo');
    expect(jobsQuote?.text.es).toContain('puedes mover montañas');
  });

  it('includes the William LeMessurier quote requested by the user', () => {
    const lemessurierQuote = getQuoteById(2);
    expect(lemessurierQuote).toBeDefined();
    expect(lemessurierQuote?.author).toBe('William LeMessurier');
    expect(lemessurierQuote?.text.es).toContain('No hay nada más satisfactorio en la ingeniería');
    expect(lemessurierQuote?.text.es).toContain('limpia, simple y honesta');
  });

  it('includes iconic quotes from famous actors, filmmakers, and cultural icons requested by the user', () => {
    const requestedIcons = [
      { name: 'Charlie Chaplin', snippet: 'simplicidad no es una cosa sencilla' },
      { name: 'Robin Williams', snippet: 'palabras y las ideas pueden cambiar el mundo' },
      { name: 'Bruce Lee', snippet: 'diez mil patadas' },
      { name: 'Keanu Reeves', snippet: 'oficio verdadero consiste en entregarte por entero' },
      { name: 'Anthony Hopkins', snippet: 'técnica debe dominarse hasta tal punto que se vuelva invisible' },
      { name: 'Denzel Washington', snippet: 'sin consistencia y disciplina nunca terminarás' },
      { name: 'Audrey Hepburn', snippet: 'elegancia es la única belleza que nunca se desvanece' },
      { name: 'Tom Hanks', snippet: 'dificultad intrínseca del reto lo que hace que el oficio sea grande' },
      { name: 'Morgan Freeman', snippet: 'No puedes apresurar la solidez de una roca' },
      { name: 'Akira Kurosawa', snippet: 'buen guion y una estructura limpia' },
    ];

    for (const icon of requestedIcons) {
      const quote = ENGINEERING_QUOTES.find((q) => q.author === icon.name);
      expect(quote, `Expected quote by ${icon.name} to exist`).toBeDefined();
      expect(quote?.text.es).toContain(icon.snippet);
      expect(quote?.text.en.trim().length).toBeGreaterThan(10);
      expect(quote?.role.es.trim().length).toBeGreaterThan(0);
      expect(quote?.role.en.trim().length).toBeGreaterThan(0);
    }
  });

  it('includes iconic quotes from movies, Dragon Ball, Suits, and pop culture requested by the user', () => {
    const popCultureIcons = [
      { name: 'Son Goku', snippet: 'Prefiero ser un mono sin cerebro' },
      { name: 'Vegeta', snippet: 'romper mis propios límites' },
      { name: 'Son Gohan', snippet: 'pelea con el corazón' },
      { name: 'Piccolo', snippet: 'estratega' },
      { name: 'Maestro Roshi', snippet: 'bases para tener una gran vida' },
      { name: 'Forrest Gump', snippet: 'caja de bombones' },
      { name: 'Rafiki', snippet: 'El pasado puede doler' },
      { name: 'Mufasa', snippet: 'Recuerda siempre quién eres' },
      { name: 'Harvey Specter', snippet: 'hago mi propia suerte' },
      { name: 'Spider-Man', snippet: 'gran poder conlleva una gran responsabilidad' },
      { name: 'Batman', snippet: 'lo que hago con mis acciones lo que me define' },
      { name: 'Rocky Balboa', snippet: 'Nadie golpea tan fuerte como la vida' },
      { name: 'Interstellar', snippet: 'dimensiones del tiempo y del espacio' },
      { name: 'Kratos', snippet: 'sé mejor' },
      { name: 'Arthur Morgan', snippet: 'hacer lo correcto' },
    ];

    for (const item of popCultureIcons) {
      const quote = ENGINEERING_QUOTES.find(
        (q) => q.author === item.name && q.text.es.includes(item.snippet),
      );
      expect(quote, `Expected quote by ${item.name} with snippet "${item.snippet}" to exist`).toBeDefined();
      expect(quote?.text.en.trim().length).toBeGreaterThan(10);
    }
  });

  it('returns a valid quote from getRandomQuote()', () => {
    const quote = getRandomQuote();
    expect(quote).toBeDefined();
    expect(quote.id).toBeGreaterThanOrEqual(1);
    expect(quote.id).toBeLessThanOrEqual(200);
    expect(ENGINEERING_QUOTES).toContain(quote);
  });
});
