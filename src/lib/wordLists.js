export const CATEGORIES = ['Pets', 'Actors', 'Movies', 'Football Players', 'European Countries', 'Household Objects'];

export const CATEGORY_EMOJIS = {
  'Pets': '🐶',
  'Actors': '🎭',
  'Movies': '🎬',
  'Football Players': '⚽',
  'European Countries': '🌍',
  'Household Objects': '🏠',
};

// Short display labels for tight UI (selection chips, subtitles). The full
// name stays the canonical value everywhere in game logic and storage —
// this only affects what's printed where space is scarce.
const CATEGORY_SHORT = {
  'Football Players': 'Football',
  'European Countries': 'Europe',
  'Household Objects': 'Household',
  'Movie Characters': 'Characters',
  'European Cities': 'Euro Cities',
  'World Capitals': 'Capitals',
  'Famous Landmarks': 'Landmarks',
  'Fast Food Chains': 'Fast Food',
  'Snacks & Candy': 'Snacks',
  'World Dishes': 'Dishes',
  'Marvel/DC Heroes': 'Superheroes',
  'Marvel/DC Villains': 'Villains',
  'Natural Wonders': 'Wonders',
  'Harry Potter Characters': 'Harry Potter',
  'Star Wars Characters': 'Star Wars',
  'Disney Characters': 'Disney',
};

export function shortCategory(cat) {
  return CATEGORY_SHORT[cat] || cat;
}

// Emoji + free/pack metadata for a category — used anywhere a category is
// shown outside the selector (lobby header, public-lobby rows). Defined
// with lazy references so it can sit above CATEGORIES/PACKS declarations.
export function categoryMeta(cat) {
  if (!cat) return null;
  if (CATEGORIES.includes(cat)) {
    return { emoji: CATEGORY_EMOJIS[cat] || '🎯', isFree: true };
  }
  if (cat === CUSTOM_CATEGORY) return { emoji: '✏️', isFree: true };
  const pack = PACKS.find(p => p.categories.includes(cat));
  return { emoji: pack?.emoji || '⭐', isFree: false, packName: pack?.name };
}

// Dutch translations for categories that contain common words (not proper nouns)
export const WORD_LISTS_NL = {
  Pets: [
    'Hond', 'Kat', 'Konijn', 'Hamster', 'Cavia',
    'Goudvis', 'Papegaai', 'Grasparkiet', 'Schildpad', 'Fret',
    'Rat', 'Muis', 'Egel', 'Kanarie', 'Valkparkiet',
    'Betta Vis', 'Gekko', 'Slang', 'Chinchilla', 'Gerbil'
  ],
  'Household Objects': [
    'Stoel', 'Tafel', 'Bank', 'Bed', 'Kledingkast',
    'Koelkast', 'Magnetron', 'Oven', 'Wasmachine', 'Televisie',
    'Lamp', 'Spiegel', 'Kussen', 'Tandenborstel', 'Toilet',
    'Stofzuiger', 'Mes', 'Mok', 'Waterkoker', 'Broodrooster',
    'Koffiezetapparaat', 'Afstandsbediening', 'Boekenkast', 'Bureau', 'Klok',
    'Handdoek', 'Zeep', 'Douche', 'Oplader', 'Bezem'
  ],
  'Wild Animals': [
    'Leeuw', 'Tijger', 'Olifant', 'Giraf', 'Zebra',
    'Gorilla', 'Panda', 'IJsbeer', 'Cheetah', 'Wolf',
    'Vos', 'Krokodil', 'Nijlpaard', 'Neushoorn', 'Kangoeroe',
    'Koala', 'Chimpansee', 'Grizzlybeer', 'Jaguar', 'Luiaard',
    'Capibara', 'Stokstaartje', 'Hyena', 'Eland', 'Bizon',
    'Otter', 'Rode Panda', 'Komodovaraan', 'Narwal', 'Walrus'
  ],
  'Farm Animals': [
    'Koe', 'Paard', 'Varken', 'Schaap', 'Geit',
    'Kip', 'Eend', 'Kalkoen', 'Gans', 'Konijn',
    'Ezel', 'Lama', 'Alpaca', 'Os', 'Haan',
    'Hen', 'Lam', 'Biggetje', 'Veulen', 'Kalf',
    'Pauw', 'Kwartel', 'Struisvogel', 'Emoe', 'Jak',
    'Herder', 'Border Collie', 'Shetland Pony', 'Arabisch Paard', 'Clydesdale'
  ],
  'Sea Animals': [
    'Blauwe Vinvis', 'Dolfijn', 'Grote Witte Haai', 'Octopus', 'Kwal',
    'Krab', 'Kreeft', 'Clownvis', 'Zeepaard', 'Zeester',
    'Mantarog', 'Hamerhaai', 'Orca', 'Zeeschildpad', 'Zeehond',
    'Pinguïn', 'Kogelvis', 'Zwaardvis', 'Tonijn', 'Zalm',
    'Inktvis', 'Zeeleeuw', 'Narwal', 'Pijlstaartrog', 'Murene',
    'Hengselvis', 'Potvis', 'Bultrug', 'Belugawalvis', 'Koraalduivel'
  ],
  Birds: [
    'Arend', 'Pinguïn', 'Flamingo', 'Pauw', 'Papegaai',
    'Uil', 'Toekan', 'Kolibrie', 'Struisvogel', 'Valk',
    'Havik', 'Gier', 'Zwaan', 'Kraanvogel', 'Ooievaar',
    'IJsvogel', 'Specht', 'Roodborstje', 'Mus', 'Duif',
    'Tortelduif', 'Ekster', 'Kraai', 'Raaf', 'Kanarie',
    'Kakatoea', 'Ara', 'Papegaaiduiker', 'Albatros', 'Kiwi'
  ],
  Insects: [
    'Vlinder', 'Libelle', 'Bij', 'Wesp', 'Mier',
    'Kever', 'Lieveheersbeestje', 'Sprinkhaan', 'Krekel', 'Glimworm',
    'Bidsprinkhaan', 'Wandelende Tak', 'Mot', 'Mug', 'Vlieg',
    'Kakkerlak', 'Termiet', 'Spin', 'Schorpioen', 'Duizendpoot',
    'Cicade', 'Treksprinkhaan', 'Vliegend Hert', 'Neushoornkever', 'Monarchvlinder',
    'Hommel', 'Honingbij', 'Horzel', 'Vlo', 'Oorworm'
  ],
  'Famous Landmarks': [
    'Eiffeltoren', 'Big Ben', 'Vrijheidsbeeld', 'Colosseum', 'Chinese Muur',
    'Taj Mahal', 'Piramides van Giza', 'Machu Picchu', 'Sagrada Família', 'Burj Khalifa',
    'Sydney Opera House', 'Mount Fuji', 'Niagarawatervallen', 'Grand Canyon', 'Stonehenge',
    'Akropolis', 'Angkor Wat', 'Chichen Itza', 'Paaseiland', 'Petra',
    'Vaticaanstad', 'Golden Gate Bridge', 'Tower Bridge', 'Christusbeeld', 'Scheve Toren van Pisa',
    'Hagia Sophia', 'Trevi Fontein', 'Buckingham Palace', 'Kasteel Neuschwanstein', 'Noorderlicht'
  ],
  'Natural Wonders': [
    'Mount Everest', 'Groot Barrièrerif', 'Saharawoestijn', 'Amazoneregenwoud', 'Victoriawatervallen',
    'Dode Zee', 'Uluru', 'Yellowstone', 'Kilimanjaro', 'Iguazuwatervallen',
    'Ha Long Bay', 'Salar de Uyuni', "Giant's Causeway", 'Pamukkale', 'Matterhorn',
    'Angelwatervallen', 'Galápagoseilanden', 'Plitvicemeren', 'Vesuvius', 'Baikalmeer',
    'Cliffs of Moher', 'Antelope Canyon', 'Etna', 'Yosemite', 'Redwoodbos',
    'Great Blue Hole', 'Perito Moreno-gletsjer', 'Zhangjiajie', 'Mont Blanc', 'Krakatau'
  ],
  Fruits: [
    'Appel', 'Banaan', 'Sinaasappel', 'Aardbei', 'Ananas',
    'Mango', 'Watermeloen', 'Druif', 'Kiwi', 'Perzik',
    'Peer', 'Kers', 'Bosbes', 'Framboos', 'Citroen',
    'Limoen', 'Kokosnoot', 'Papaja', 'Granaatappel', 'Vijg',
    'Pruim', 'Abrikoos', 'Meloen', 'Drakenfruit', 'Passievrucht',
    'Lychee', 'Grapefruit', 'Braam', 'Nectarine', 'Avocado'
  ],
  Vegetables: [
    'Wortel', 'Aardappel', 'Tomaat', 'Komkommer', 'Broccoli',
    'Bloemkool', 'Spinazie', 'Sla', 'Ui', 'Knoflook',
    'Paprika', 'Courgette', 'Aubergine', 'Pompoen', 'Maïs',
    'Doperwten', 'Sperzieboon', 'Champignon', 'Radijs', 'Rode biet',
    'Kool', 'Boerenkool', 'Bleekselderij', 'Prei', 'Asperge',
    'Zoete aardappel', 'Spruitjes', 'Artisjok', 'Bosui', 'Tuinkers'
  ],
  'Snacks & Candy': [
    'Popcorn', 'Chips', 'Pretzel', 'Nachos', 'Chocoladereep',
    'Gummybeertjes', 'Lolly', 'Suikerspin', 'Drop', 'Marshmallow',
    'Jelly Beans', 'Zuurstok', 'Kauwgom', 'Karamel', 'Fudge',
    'Toffee', 'M&M\'s', 'Skittles', 'Oreo', 'Doritos',
    'Pringles', 'Cheetos', 'Studentenhaver', 'Mueslireep', 'Rijstwafel',
    'Crackers', 'Waterijsje', 'Sour Patch Kids', 'Kinder Surprise', 'Haribo'
  ],
  Desserts: [
    'IJs', 'Chocoladetaart', 'Cheesecake', 'Appeltaart', 'Brownie',
    'Cupcake', 'Donut', 'Pannenkoeken', 'Wafels', 'Tiramisu',
    'Crème Brûlée', 'Macaron', 'Éclair', 'Pudding', 'Chocolademousse',
    'Koekje', 'Muffin', 'Bananensplit', 'Churros', 'Baklava',
    'Gelato', 'Sorbet', 'Panna Cotta', 'Vla', 'Fruitsalade',
    'Worteltaart', 'Red Velvet-taart', 'Citroentaart', 'Kaneelbroodje', 'Pavlova'
  ],
  Drinks: [
    'Koffie', 'Thee', 'Warme chocolademelk', 'Sinaasappelsap', 'Appelsap',
    'Limonade', 'IJsthee', 'Milkshake', 'Smoothie', 'Cola',
    'Energiedrank', 'Bruiswater', 'Melk', 'Chocolademelk', 'Bubble Tea',
    'Espresso', 'Cappuccino', 'Latte', 'Groene thee', 'Kokoswater',
    'Root Beer', 'Ginger Ale', 'Bier', 'Wijn', 'Champagne',
    'Cocktail', 'Vruchtenpunch', 'Slush', 'Kombucha', 'Matcha'
  ],
};

export const PACKS = [
  {
    id: 'pop_culture',
    name: 'Pop Culture Pack',
    emoji: '🌟',
    categories: ['Celebrities', 'TV Shows', 'Music Artists', 'YouTubers', 'Video Games', 'Movie Characters']
  },
  {
    id: 'animals',
    name: 'Animal Pack',
    emoji: '🐾',
    categories: ['Wild Animals', 'Farm Animals', 'Sea Animals', 'Birds', 'Insects', 'Dinosaurs']
  },
  {
    id: 'world',
    name: 'World Pack',
    emoji: '🌍',
    // 'European Countries' used to sit here too, but it's one of the FREE
    // categories — a paid pack must never resell something free. Natural
    // Wonders replaces it: same theme, no overlap with (man-made) Landmarks.
    categories: ['Countries', 'Natural Wonders', 'European Cities', 'World Capitals', 'Famous Landmarks', 'US States']
  },
  {
    id: 'brands',
    name: 'Brands Pack',
    emoji: '🏷️',
    categories: ['Fashion Brands', 'Tech Brands', 'Fast Food Chains', 'Sports Brands', 'Game Studios', 'Car Brands']
  },
  {
    id: 'fantasy',
    name: 'Fantasy Pack',
    emoji: '🦸',
    categories: ['Pokémon', 'Disney Characters', 'Marvel/DC Heroes', 'Marvel/DC Villains', 'Harry Potter Characters', 'Star Wars Characters']
  },
  {
    id: 'food',
    name: 'Food Pack',
    emoji: '🍔',
    categories: ['Fruits', 'Vegetables', 'Snacks & Candy', 'Desserts', 'Drinks', 'World Dishes']
  }
];

export const ALL_PREMIUM_CATEGORIES = PACKS.flatMap(p => p.categories);
export const CUSTOM_CATEGORY = 'Custom';

export const WORD_LISTS = {
  Pets: [
    'Dog', 'Cat', 'Rabbit', 'Hamster', 'Guinea Pig',
    'Goldfish', 'Parrot', 'Budgie', 'Turtle', 'Ferret',
    'Rat', 'Mouse', 'Hedgehog', 'Canary', 'Cockatiel',
    'Betta Fish', 'Gecko', 'Snake', 'Chinchilla', 'Gerbil'
  ],
  Actors: [
    'Tom Hanks', 'Leonardo DiCaprio', 'Brad Pitt', 'Will Smith', 'Morgan Freeman',
    'Robert Downey Jr.', 'Johnny Depp', 'Tom Cruise', 'Denzel Washington', 'Ryan Reynolds',
    'Dwayne Johnson', 'Chris Evans', 'Hugh Jackman', 'Keanu Reeves', 'Scarlett Johansson',
    'Meryl Streep', 'Angelina Jolie', 'Jennifer Lawrence', 'Emma Stone', 'Margot Robbie',
    'Emma Watson', 'Zendaya', 'Samuel L. Jackson', 'Harrison Ford', 'Jim Carrey',
    'Adam Sandler', 'Kevin Hart', 'Ryan Gosling', 'Timothée Chalamet', 'Joaquin Phoenix'
  ],
  Movies: [
    'Titanic', 'Avatar', 'The Avengers', 'The Dark Knight', 'Inception',
    'Interstellar', 'The Lion King', 'Frozen', 'Toy Story', 'The Godfather',
    'Forrest Gump', 'The Matrix', 'Jurassic Park', 'Star Wars', 'The Lord of the Rings',
    'Harry Potter', 'Shrek', 'Finding Nemo', 'Avengers: Endgame', 'Joker',
    'Deadpool', 'Dune', 'John Wick', 'Top Gun', 'Home Alone',
    'La La Land', 'Parasite', 'Spirited Away', 'Minions', 'Kung Fu Panda'
  ],
  'European Countries': [
    'Germany', 'France', 'United Kingdom', 'Italy', 'Spain',
    'Poland', 'Netherlands', 'Belgium', 'Sweden', 'Norway',
    'Denmark', 'Finland', 'Switzerland', 'Austria', 'Portugal',
    'Greece', 'Czech Republic', 'Romania', 'Hungary', 'Ireland',
    'Croatia', 'Slovakia', 'Bulgaria', 'Ukraine', 'Iceland',
    'Luxembourg', 'Slovenia', 'Serbia', 'Cyprus', 'Malta'
  ],
  'Household Objects': [
    'Chair', 'Table', 'Sofa', 'Bed', 'Wardrobe',
    'Refrigerator', 'Microwave', 'Oven', 'Washing Machine', 'Television',
    'Lamp', 'Mirror', 'Pillow', 'Toothbrush', 'Toilet',
    'Vacuum Cleaner', 'Knife', 'Mug', 'Kettle', 'Toaster',
    'Coffee Machine', 'Remote Control', 'Bookshelf', 'Desk', 'Clock',
    'Towel', 'Soap', 'Shower', 'Phone Charger', 'Broom'
  ],
  'Football Players': [
    'Lionel Messi', 'Cristiano Ronaldo', 'Neymar', 'Kylian Mbappé', 'Erling Haaland',
    'Pelé', 'Diego Maradona', 'Zinedine Zidane', 'Ronaldinho', 'Thierry Henry',
    'Mohamed Salah', 'Kevin De Bruyne', 'Harry Kane', 'Jude Bellingham', 'Vinicius Jr',
    'Robert Lewandowski', 'Karim Benzema', 'Zlatan Ibrahimović', 'David Beckham', 'Lamine Yamal',
    'Pedri', 'Phil Foden', 'Bukayo Saka', 'Virgil van Dijk', 'Andrés Iniesta',
    'Xavi Hernández', 'Wayne Rooney', 'Frank Lampard', 'Steven Gerrard', 'Jamal Musiala'
  ]
};

export const PREMIUM_WORD_LISTS = {
  // ── Pop Culture Pack ──────────────────────────────────────────────────────
  Celebrities: [
    'Kim Kardashian', 'Kylie Jenner', 'Paris Hilton', 'Britney Spears', 'Miley Cyrus',
    'Oprah Winfrey', 'Elon Musk', 'Jeff Bezos', 'Bill Gates', 'Mark Zuckerberg',
    'Donald Trump', 'Barack Obama', 'Meghan Markle', 'Prince Harry', 'Kate Middleton',
    'David Beckham', 'Beyoncé', 'Taylor Swift', 'Rihanna', 'Adele',
    'Ariana Grande', 'Billie Eilish', 'Selena Gomez', 'Lady Gaga', 'Justin Bieber',
    'Harry Styles', 'Dua Lipa', 'Zendaya', 'Ryan Reynolds', 'Dwayne Johnson'
  ],
  'TV Shows': [
    'Breaking Bad', 'Game of Thrones', 'Friends', 'The Office', 'Stranger Things',
    'The Crown', 'Succession', 'Euphoria', 'Squid Game', 'Money Heist',
    'Peaky Blinders', 'Better Call Saul', 'Black Mirror', 'Prison Break', 'Grey\'s Anatomy',
    'Gossip Girl', 'Bridgerton', 'The Witcher', 'The Mandalorian', 'The Last of Us',
    'The Boys', 'Ted Lasso', 'White Lotus', 'Rick and Morty', 'The Simpsons',
    'South Park', 'Family Guy', 'Attack on Titan', 'Naruto', 'One Piece'
  ],
  'Music Artists': [
    'Taylor Swift', 'Beyoncé', 'Rihanna', 'Ariana Grande', 'Billie Eilish',
    'Lady Gaga', 'Adele', 'Dua Lipa', 'Olivia Rodrigo', 'The Weeknd',
    'Drake', 'Kendrick Lamar', 'Ed Sheeran', 'Justin Bieber', 'Bruno Mars',
    'Harry Styles', 'Michael Jackson', 'Elvis Presley', 'Madonna', 'Freddie Mercury',
    'Elton John', 'Whitney Houston', 'Eminem', 'Kanye West', 'Bad Bunny',
    'Shakira', 'The Beatles', 'Queen', 'Coldplay', 'Daft Punk'
  ],
  YouTubers: [
    'MrBeast', 'PewDiePie', 'Markiplier', 'Jacksepticeye', 'Ninja',
    'Pokimane', 'Logan Paul', 'Jake Paul', 'KSI', 'Sidemen',
    'Dude Perfect', 'Jeffree Star', 'David Dobrik', 'Emma Chamberlain', 'Mark Rober',
    'Vsauce', 'Linus Tech Tips', 'Marques Brownlee', 'Casey Neistat', 'Kurzgesagt',
    'Tom Scott', 'Ryan Trahan', 'IShowSpeed', 'Kai Cenat', 'xQc',
    'Dream', 'GeorgeNotFound', 'DanTDM', 'Smosh', 'Rhett and Link'
  ],
  'Video Games': [
    'Minecraft', 'Fortnite', 'Grand Theft Auto V', 'Call of Duty', 'FIFA',
    'League of Legends', 'Valorant', 'Overwatch', 'Apex Legends', 'Counter-Strike',
    'The Legend of Zelda', 'Super Mario', 'Pokémon', 'Animal Crossing', 'The Witcher 3',
    'Cyberpunk 2077', 'Elden Ring', 'God of War', 'The Last of Us', 'Red Dead Redemption 2',
    'Roblox', 'Among Us', 'Rocket League', 'Mario Kart', 'Smash Bros',
    'Tetris', 'Stardew Valley', 'Skyrim', 'Half-Life', 'Doom'
  ],
  'Movie Characters': [
    'Harry Potter', 'Hermione Granger', 'Frodo Baggins', 'Gandalf', 'Darth Vader',
    'Luke Skywalker', 'Jack Sparrow', 'Indiana Jones', 'James Bond', 'Batman',
    'Superman', 'Spider-Man', 'Iron Man', 'Thor', 'Joker',
    'The Terminator', 'Shrek', 'Simba', 'Elsa', 'Buzz Lightyear',
    'Woody', 'Nemo', 'Katniss Everdeen', 'Neo', 'John Wick',
    'Deadpool', 'Wolverine', 'Thanos', 'Loki', 'Voldemort'
  ],

  // ── Animal Pack ────────────────────────────────────────────────────────────
  'Wild Animals': [
    'Lion', 'Tiger', 'Elephant', 'Giraffe', 'Zebra',
    'Gorilla', 'Panda', 'Polar Bear', 'Cheetah', 'Wolf',
    'Fox', 'Crocodile', 'Hippopotamus', 'Rhinoceros', 'Kangaroo',
    'Koala', 'Chimpanzee', 'Grizzly Bear', 'Jaguar', 'Sloth',
    'Capybara', 'Meerkat', 'Hyena', 'Moose', 'Bison',
    'Otter', 'Red Panda', 'Komodo Dragon', 'Narwhal', 'Walrus'
  ],
  'Farm Animals': [
    'Cow', 'Horse', 'Pig', 'Sheep', 'Goat',
    'Chicken', 'Duck', 'Turkey', 'Goose', 'Rabbit',
    'Donkey', 'Llama', 'Alpaca', 'Ox', 'Rooster',
    'Hen', 'Lamb', 'Piglet', 'Foal', 'Calf',
    'Peacock', 'Quail', 'Ostrich', 'Emu', 'Yak',
    'Sheepdog', 'Border Collie', 'Shetland Pony', 'Arabian Horse', 'Clydesdale'
  ],
  'Sea Animals': [
    'Blue Whale', 'Dolphin', 'Great White Shark', 'Octopus', 'Jellyfish',
    'Crab', 'Lobster', 'Clownfish', 'Seahorse', 'Starfish',
    'Manta Ray', 'Hammerhead Shark', 'Orca', 'Sea Turtle', 'Seal',
    'Penguin', 'Puffer Fish', 'Swordfish', 'Tuna', 'Salmon',
    'Squid', 'Sea Lion', 'Narwhal', 'Stingray', 'Moray Eel',
    'Anglerfish', 'Sperm Whale', 'Humpback Whale', 'Beluga Whale', 'Lionfish'
  ],
  Birds: [
    'Eagle', 'Penguin', 'Flamingo', 'Peacock', 'Parrot',
    'Owl', 'Toucan', 'Hummingbird', 'Ostrich', 'Falcon',
    'Hawk', 'Vulture', 'Swan', 'Crane', 'Stork',
    'Kingfisher', 'Woodpecker', 'Robin', 'Sparrow', 'Pigeon',
    'Dove', 'Magpie', 'Crow', 'Raven', 'Canary',
    'Cockatoo', 'Macaw', 'Puffin', 'Albatross', 'Kiwi'
  ],
  Insects: [
    'Butterfly', 'Dragonfly', 'Bee', 'Wasp', 'Ant',
    'Beetle', 'Ladybird', 'Grasshopper', 'Cricket', 'Firefly',
    'Praying Mantis', 'Stick Insect', 'Moth', 'Mosquito', 'Fly',
    'Cockroach', 'Termite', 'Spider', 'Scorpion', 'Centipede',
    'Cicada', 'Locust', 'Stag Beetle', 'Rhinoceros Beetle', 'Monarch Butterfly',
    'Bumblebee', 'Honeybee', 'Hornet', 'Flea', 'Earwig'
  ],
  Dinosaurs: [
    'Tyrannosaurus Rex', 'Velociraptor', 'Triceratops', 'Stegosaurus', 'Brachiosaurus',
    'Diplodocus', 'Ankylosaurus', 'Spinosaurus', 'Allosaurus', 'Pterodactyl',
    'Pteranodon', 'Mosasaurus', 'Plesiosaur', 'Parasaurolophus', 'Iguanodon',
    'Pachycephalosaurus', 'Carnotaurus', 'Dilophosaurus', 'Compsognathus', 'Archaeopteryx',
    'Oviraptor', 'Gallimimus', 'Baryonyx', 'Giganotosaurus', 'Argentinosaurus',
    'Maiasaura', 'Corythosaurus', 'Pachyrhinosaurus', 'Torosaurus', 'Therizinosaurus'
  ],

  // ── World Pack ─────────────────────────────────────────────────────────────
  Countries: [
    'United States', 'United Kingdom', 'France', 'Germany', 'Japan',
    'Canada', 'Australia', 'Brazil', 'India', 'China',
    'Russia', 'Italy', 'Spain', 'Mexico', 'South Korea',
    'Netherlands', 'Turkey', 'Argentina', 'South Africa', 'Nigeria',
    'Egypt', 'Indonesia', 'Sweden', 'Switzerland', 'Poland',
    'Portugal', 'Greece', 'New Zealand', 'UAE', 'Saudi Arabia'
  ],
  'European Countries': [
    'Germany', 'France', 'United Kingdom', 'Italy', 'Spain',
    'Poland', 'Netherlands', 'Belgium', 'Sweden', 'Norway',
    'Denmark', 'Finland', 'Switzerland', 'Austria', 'Portugal',
    'Greece', 'Czech Republic', 'Romania', 'Hungary', 'Ireland',
    'Croatia', 'Slovakia', 'Bulgaria', 'Ukraine', 'Iceland',
    'Luxembourg', 'Slovenia', 'Serbia', 'Cyprus', 'Malta'
  ],
  'European Cities': [
    'Paris', 'London', 'Berlin', 'Rome', 'Madrid',
    'Barcelona', 'Amsterdam', 'Vienna', 'Prague', 'Budapest',
    'Warsaw', 'Athens', 'Lisbon', 'Dublin', 'Copenhagen',
    'Stockholm', 'Oslo', 'Helsinki', 'Brussels', 'Zurich',
    'Milan', 'Munich', 'Istanbul', 'Venice', 'Florence',
    'Porto', 'Kyiv', 'Bucharest', 'Zagreb', 'Reykjavik'
  ],
  'World Capitals': [
    'Washington D.C.', 'London', 'Paris', 'Berlin', 'Tokyo',
    'Beijing', 'Moscow', 'Ottawa', 'Canberra', 'Brasília',
    'New Delhi', 'Rome', 'Madrid', 'Seoul', 'Amsterdam',
    'Vienna', 'Warsaw', 'Prague', 'Athens', 'Lisbon',
    'Dublin', 'Copenhagen', 'Stockholm', 'Ankara', 'Cairo',
    'Buenos Aires', 'Mexico City', 'Riyadh', 'Bangkok', 'Jakarta'
  ],
  'Famous Landmarks': [
    'Eiffel Tower', 'Big Ben', 'Statue of Liberty', 'Colosseum', 'Great Wall of China',
    'Taj Mahal', 'Pyramids of Giza', 'Machu Picchu', 'Sagrada Família', 'Burj Khalifa',
    'Sydney Opera House', 'Mount Fuji', 'Niagara Falls', 'Grand Canyon', 'Stonehenge',
    'Acropolis', 'Angkor Wat', 'Chichen Itza', 'Easter Island', 'Petra',
    'Vatican City', 'Golden Gate Bridge', 'Tower Bridge', 'Christ the Redeemer', 'Leaning Tower of Pisa',
    'Hagia Sophia', 'Trevi Fountain', 'Buckingham Palace', 'Neuschwanstein Castle', 'Northern Lights'
  ],
  // No overlap with Famous Landmarks (that list already has Mount Fuji,
  // Niagara Falls, Grand Canyon, Northern Lights) — the pack must never
  // hand out the same secret word from two categories.
  'Natural Wonders': [
    'Mount Everest', 'Great Barrier Reef', 'Sahara Desert', 'Amazon Rainforest', 'Victoria Falls',
    'Dead Sea', 'Uluru', 'Yellowstone', 'Mount Kilimanjaro', 'Iguazu Falls',
    'Ha Long Bay', 'Salar de Uyuni', "Giant's Causeway", 'Pamukkale', 'Matterhorn',
    'Angel Falls', 'Galápagos Islands', 'Plitvice Lakes', 'Mount Vesuvius', 'Lake Baikal',
    'Cliffs of Moher', 'Antelope Canyon', 'Mount Etna', 'Yosemite', 'Redwood Forest',
    'Great Blue Hole', 'Perito Moreno Glacier', 'Zhangjiajie', 'Mont Blanc', 'Krakatoa'
  ],
  'US States': [
    'California', 'Texas', 'Florida', 'New York', 'Illinois',
    'Pennsylvania', 'Ohio', 'Georgia', 'Michigan', 'New Jersey',
    'Virginia', 'Washington', 'Arizona', 'Massachusetts', 'Tennessee',
    'Indiana', 'Missouri', 'Colorado', 'Minnesota', 'South Carolina',
    'Alabama', 'Louisiana', 'Kentucky', 'Oregon', 'Connecticut',
    'Utah', 'Nevada', 'Iowa', 'Hawaii', 'Alaska'
  ],

  // ── Brands Pack ────────────────────────────────────────────────────────────
  'Fashion Brands': [
    'Louis Vuitton', 'Gucci', 'Chanel', 'Prada', 'Hermès',
    'Versace', 'Dior', 'Balenciaga', 'Burberry', 'Dolce & Gabbana',
    'Giorgio Armani', 'Hugo Boss', 'Calvin Klein', 'Tommy Hilfiger', 'Ralph Lauren',
    'Zara', 'H&M', 'Uniqlo', 'Levi\'s', 'Supreme',
    'Off-White', 'Stone Island', 'Stella McCartney', 'Alexander McQueen', 'Vivienne Westwood',
    'Michael Kors', 'Coach', 'Marc Jacobs', 'Valentino', 'Givenchy'
  ],
  'Tech Brands': [
    'Apple', 'Google', 'Microsoft', 'Amazon', 'Meta',
    'Samsung', 'Sony', 'Huawei', 'Xiaomi', 'Intel',
    'Nvidia', 'Dell', 'HP', 'Lenovo', 'Razer',
    'Netflix', 'Spotify', 'TikTok', 'Instagram', 'Twitter / X',
    'Uber', 'Airbnb', 'PayPal', 'Zoom', 'Adobe',
    'Nintendo', 'PlayStation', 'Xbox', 'Discord', 'OpenAI'
  ],
  'Fast Food Chains': [
    'McDonald\'s', 'Burger King', 'KFC', 'Subway', 'Pizza Hut',
    'Domino\'s', 'Taco Bell', 'Wendy\'s', 'Popeyes', 'Five Guys',
    'Shake Shack', 'Chipotle', 'Starbucks', 'Dunkin\'', 'Tim Hortons',
    'Costa Coffee', 'Nando\'s', 'Greggs', 'Jollibee', 'Wagamama',
    'Papa John\'s', 'Panera Bread', 'Little Caesars', 'Krispy Kreme', 'Dairy Queen',
    'Panda Express', 'Wingstop', 'In-N-Out', 'Arby\'s', 'Chick-fil-A'
  ],
  'Sports Brands': [
    'Nike', 'Adidas', 'Puma', 'Under Armour', 'New Balance',
    'Reebok', 'Converse', 'Vans', 'ASICS', 'The North Face',
    'Patagonia', 'Columbia', 'Wilson', 'Callaway', 'Speedo',
    'Oakley', 'GoPro', 'Garmin', 'Fitbit', 'Umbro',
    'Hummel', 'Fila', 'Mizuno', 'Brooks', 'Hoka',
    'On Running', 'Quiksilver', 'Billabong', 'Salomon', 'Rossignol'
  ],
  'Game Studios': [
    'Nintendo', 'PlayStation (Sony)', 'Xbox (Microsoft)', 'Valve', 'Blizzard',
    'Activision', 'EA (Electronic Arts)', 'Ubisoft', 'Rockstar Games', 'Naughty Dog',
    'Bungie', 'Bethesda', 'CD Projekt Red', 'FromSoftware', 'Capcom',
    'Square Enix', 'Konami', 'Sega', 'Epic Games', 'Riot Games',
    'Mojang', 'Supercell', 'Respawn Entertainment', 'BioWare', '2K Games',
    'Remedy Entertainment', 'Guerrilla Games', 'Santa Monica Studio', 'Game Freak', 'id Software'
  ],
  'Car Brands': [
    'Ferrari', 'Lamborghini', 'Porsche', 'BMW', 'Mercedes-Benz',
    'Audi', 'Volkswagen', 'Toyota', 'Honda', 'Ford',
    'Chevrolet', 'Tesla', 'Rolls-Royce', 'Bentley', 'Bugatti',
    'McLaren', 'Aston Martin', 'Jaguar', 'Land Rover', 'Volvo',
    'Subaru', 'Nissan', 'Hyundai', 'Kia', 'Jeep',
    'Dodge', 'Alfa Romeo', 'Fiat', 'Peugeot', 'Renault'
  ],

  // ── Fantasy Pack ───────────────────────────────────────────────────────────
  'Pokémon': [
    'Pikachu', 'Charizard', 'Mewtwo', 'Eevee', 'Gengar',
    'Snorlax', 'Bulbasaur', 'Squirtle', 'Charmander', 'Jigglypuff',
    'Meowth', 'Psyduck', 'Magikarp', 'Gyarados', 'Dragonite',
    'Alakazam', 'Arcanine', 'Mew', 'Lugia', 'Ho-Oh',
    'Tyranitar', 'Lucario', 'Gardevoir', 'Greninja', 'Sylveon',
    'Mimikyu', 'Rayquaza', 'Kyogre', 'Groudon', 'Arceus'
  ],
  'Disney Characters': [
    'Mickey Mouse', 'Minnie Mouse', 'Donald Duck', 'Goofy', 'Pluto',
    'Simba', 'Elsa', 'Anna', 'Moana', 'Rapunzel',
    'Belle', 'Cinderella', 'Ariel', 'Mulan', 'Jasmine',
    'Buzz Lightyear', 'Woody', 'Nemo', 'Dory', 'Stitch',
    'Olaf', 'Genie', 'Maleficent', 'Scar', 'Tinker Bell',
    'Peter Pan', 'Dumbo', 'Bambi', 'Pinocchio', 'Mirabel'
  ],
  'Marvel/DC Heroes': [
    'Iron Man', 'Spider-Man', 'Captain America', 'Thor', 'Black Widow',
    'Hulk', 'Black Panther', 'Doctor Strange', 'Wolverine', 'Deadpool',
    'Scarlet Witch', 'Captain Marvel', 'Ant-Man', 'Hawkeye', 'Groot',
    'Star-Lord', 'Batman', 'Superman', 'Wonder Woman', 'The Flash',
    'Aquaman', 'Nightwing', 'Shazam', 'Daredevil', 'Ghost Rider',
    'Silver Surfer', 'Green Lantern', 'Robin', 'Vision', 'Gamora'
  ],
  'Marvel/DC Villains': [
    'Thanos', 'Loki', 'Ultron', 'Red Skull', 'Magneto',
    'Doctor Doom', 'Venom', 'Green Goblin', 'Carnage', 'Hela',
    'Kang the Conqueror', 'Galactus', 'Apocalypse', 'Juggernaut', 'Sabretooth',
    'Joker', 'Lex Luthor', 'Darkseid', 'Brainiac', 'Catwoman',
    'Harley Quinn', 'Poison Ivy', 'The Riddler', 'Two-Face', 'Bane',
    'Penguin', 'Scarecrow', 'Deathstroke', 'Mysterio', 'Dormammu'
  ],
  'Harry Potter Characters': [
    'Harry Potter', 'Hermione Granger', 'Ron Weasley', 'Albus Dumbledore', 'Voldemort',
    'Severus Snape', 'Draco Malfoy', 'Sirius Black', 'Remus Lupin', 'Neville Longbottom',
    'Luna Lovegood', 'Ginny Weasley', 'Fred Weasley', 'George Weasley', 'Molly Weasley',
    'Bellatrix Lestrange', 'Lucius Malfoy', 'Rubeus Hagrid', 'Minerva McGonagall', 'Dolores Umbridge',
    'Cedric Diggory', 'Viktor Krum', 'Fleur Delacour', 'Dobby', 'Hedwig',
    'Fawkes', 'Mad-Eye Moody', 'Nymphadora Tonks', 'Gilderoy Lockhart', 'Peter Pettigrew'
  ],
  'Star Wars Characters': [
    'Luke Skywalker', 'Darth Vader', 'Princess Leia', 'Han Solo', 'Obi-Wan Kenobi',
    'Yoda', 'Emperor Palpatine', 'Chewbacca', 'R2-D2', 'C-3PO',
    'Boba Fett', 'Mace Windu', 'Qui-Gon Jinn', 'Padmé Amidala', 'Anakin Skywalker',
    'Kylo Ren', 'Rey', 'Finn', 'Poe Dameron', 'The Mandalorian',
    'Grogu', 'Ahsoka Tano', 'Count Dooku', 'Darth Maul', 'General Grievous',
    'Jabba the Hutt', 'Lando Calrissian', 'BB-8', 'Grand Admiral Thrawn', 'Jango Fett'
  ],

  // ── Food Pack ─────────────────────────────────────────────────────────────
  Fruits: [
    'Apple', 'Banana', 'Orange', 'Strawberry', 'Pineapple',
    'Mango', 'Watermelon', 'Grape', 'Kiwi', 'Peach',
    'Pear', 'Cherry', 'Blueberry', 'Raspberry', 'Lemon',
    'Lime', 'Coconut', 'Papaya', 'Pomegranate', 'Fig',
    'Plum', 'Apricot', 'Melon', 'Dragon Fruit', 'Passion Fruit',
    'Lychee', 'Grapefruit', 'Blackberry', 'Nectarine', 'Avocado'
  ],
  Vegetables: [
    'Carrot', 'Potato', 'Tomato', 'Cucumber', 'Broccoli',
    'Cauliflower', 'Spinach', 'Lettuce', 'Onion', 'Garlic',
    'Bell Pepper', 'Zucchini', 'Eggplant', 'Pumpkin', 'Corn',
    'Peas', 'Green Bean', 'Mushroom', 'Radish', 'Beetroot',
    'Cabbage', 'Kale', 'Celery', 'Leek', 'Asparagus',
    'Sweet Potato', 'Brussels Sprouts', 'Artichoke', 'Spring Onion', 'Cress'
  ],
  'Snacks & Candy': [
    'Popcorn', 'Chips', 'Pretzel', 'Nachos', 'Chocolate Bar',
    'Gummy Bears', 'Lollipop', 'Cotton Candy', 'Licorice', 'Marshmallow',
    'Jelly Beans', 'Candy Cane', 'Bubblegum', 'Caramel', 'Fudge',
    'Toffee', 'M&M\'s', 'Skittles', 'Oreo', 'Doritos',
    'Pringles', 'Cheetos', 'Trail Mix', 'Granola Bar', 'Rice Cake',
    'Crackers', 'Popsicle', 'Sour Patch Kids', 'Kinder Surprise', 'Haribo'
  ],
  Desserts: [
    'Ice Cream', 'Chocolate Cake', 'Cheesecake', 'Apple Pie', 'Brownie',
    'Cupcake', 'Donut', 'Pancakes', 'Waffles', 'Tiramisu',
    'Crème Brûlée', 'Macaron', 'Éclair', 'Pudding', 'Chocolate Mousse',
    'Cookie', 'Muffin', 'Banana Split', 'Churros', 'Baklava',
    'Gelato', 'Sorbet', 'Panna Cotta', 'Custard', 'Fruit Salad',
    'Carrot Cake', 'Red Velvet Cake', 'Lemon Tart', 'Cinnamon Roll', 'Pavlova'
  ],
  Drinks: [
    'Coffee', 'Tea', 'Hot Chocolate', 'Orange Juice', 'Apple Juice',
    'Lemonade', 'Iced Tea', 'Milkshake', 'Smoothie', 'Cola',
    'Energy Drink', 'Sparkling Water', 'Milk', 'Chocolate Milk', 'Bubble Tea',
    'Espresso', 'Cappuccino', 'Latte', 'Green Tea', 'Coconut Water',
    'Root Beer', 'Ginger Ale', 'Beer', 'Wine', 'Champagne',
    'Cocktail', 'Fruit Punch', 'Slushy', 'Kombucha', 'Matcha'
  ],
  'World Dishes': [
    'Pizza', 'Sushi', 'Tacos', 'Carbonara', 'Ramen',
    'Pad Thai', 'Paella', 'Curry', 'Burrito', 'Lasagna',
    'Falafel', 'Hummus', 'Dim Sum', 'Pho', 'Kebab',
    'Poke Bowl', 'Fish and Chips', 'Croissant', 'Bibimbap', 'Butter Chicken',
    'Couscous', 'Gyros', 'Schnitzel', 'Goulash', 'Dumplings',
    'Spring Rolls', 'Risotto', 'Fondue', 'Nasi Goreng', 'Stamppot'
  ]
};

// Build EN→NL lookup after both WORD_LISTS and WORD_LISTS_NL are defined
const EN_TO_NL = {};
Object.entries(WORD_LISTS_NL).forEach(([cat, nlWords]) => {
  // Premium categories translate too — WORD_LISTS alone silently skipped
  // them, so stored EN words in e.g. Famous Landmarks never displayed Dutch.
  const enWords = WORD_LISTS[cat] || PREMIUM_WORD_LISTS[cat] || [];
  nlWords.forEach((nl, i) => { if (enWords[i]) EN_TO_NL[enWords[i].toLowerCase()] = nl; });
});

export function toDisplayWord(word, lang) {
  if (!word || lang !== 'nl') return word;
  return EN_TO_NL[word.toLowerCase()] || word;
}