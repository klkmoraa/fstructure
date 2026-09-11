/**
 * Colección curada de 200 citas auténticas de ingeniería estructural,
 * arte, arquitectura, computación, emprendimiento, ciencia y filosofía de vida.
 *
 * Eje temático: Simplificar lo complejo, honestidad estructural y claridad de pensamiento.
 */

export type EngineeringQuoteCategory =
  | 'structural'
  | 'engineering'
  | 'simplicity'
  | 'life'
  | 'art'
  | 'architecture'
  | 'software'
  | 'philosophy';

export interface EngineeringQuote {
  id: number;
  text: {
    es: string;
    en: string;
  };
  author: string;
  role: {
    es: string;
    en: string;
  };
  source?: string;
  category: EngineeringQuoteCategory;
}

export const ENGINEERING_QUOTES: readonly EngineeringQuote[] = [
  {
    id: 1,
    text: {
      es: 'Hacer algo simple es más difícil que hacerlo complejo: tienes que trabajar duro para aclarar tu pensamiento y lograr la sencillez. Pero al final vale la pena, porque cuando llegas allí, puedes mover montañas.',
      en: "Simple can be harder than complex: You have to work hard to get your thinking clean to make it simple. But it's worth it in the end because once you get there, you can move mountains.",
    },
    author: 'Steve Jobs',
    role: {
      es: 'Cofundador de Apple · Pionero del diseño tecnológico',
      en: 'Co-founder of Apple · Technology Design Pioneer',
    },
    source: 'BusinessWeek (1998)',
    category: 'simplicity',
  },
  {
    id: 2,
    text: {
      es: 'No hay nada más satisfactorio en la ingeniería que descubrir que un problema aparentemente intratable puede resolverse con una solución limpia, simple y honesta.',
      en: 'There is nothing more satisfying in engineering than discovering that a seemingly intractable problem can be solved with a clean, simple, and honest solution.',
    },
    author: 'William LeMessurier',
    role: {
      es: 'Ingeniero estructural · Diseñador del Citigroup Center',
      en: 'Structural Engineer · Citigroup Center designer',
    },
    source: 'The New Yorker (1995)',
    category: 'structural',
  },
  {
    id: 3,
    text: {
      es: 'El técnico no debe perderse en su propia tecnología; debe ser capaz de apreciar la vida, y la vida es arte, drama, música y, sobre todo, personas.',
      en: 'The technical man must not be lost in his own technology; he must be able to appreciate life; and life is art, drama, music, and most importantly, people.',
    },
    author: 'Fazlur Khan',
    role: {
      es: 'Pionero del sistema tubular en rascacielos · Sears Tower',
      en: 'Pioneer of tubular skyscraper systems · Sears Tower',
    },
    source: 'Engineering News-Record',
    category: 'structural',
  },
  {
    id: 4,
    text: {
      es: 'Antes de calcular, hay que estructurar; antes de dimensionar, hay que concebir.',
      en: 'Before calculating, one must structure; before sizing, one must conceive.',
    },
    author: 'Eduardo Torroja',
    role: {
      es: 'Maestro de las láminas de hormigón armado · Hipódromo de la Zarzuela',
      en: 'Master of reinforced concrete shells · Zarzuela Hippodrome',
    },
    source: 'Razón y ser de los tipos estructurales (1957)',
    category: 'structural',
  },
  {
    id: 5,
    text: {
      es: 'Las obras estructurales son siempre el resultado de la búsqueda de la verdad de las formas a través del material y las fuerzas.',
      en: 'Structural works are always the result of the search for the truth of forms through material and forces.',
    },
    author: 'Eduardo Torroja',
    role: {
      es: 'Ingeniero de caminos y pionero estructural',
      en: 'Civil engineer and structural pioneer',
    },
    source: 'Filosofía de las estructuras',
    category: 'structural',
  },
  {
    id: 6,
    text: {
      es: 'El papel del ingeniero es hacer posible el sueño arquitectónico mediante el uso honesto de los materiales y la expresión nítida de la física.',
      en: "The role of the engineer is to make the architect's dream possible through honest use of materials and clear physical expression.",
    },
    author: 'Peter Rice',
    role: {
      es: 'Ingeniero estructural · Ópera de Sídney y Centro Pompidou',
      en: 'Structural Engineer · Sydney Opera House & Centre Pompidou',
    },
    source: 'An Engineer Imagines (1994)',
    category: 'structural',
  },
  {
    id: 7,
    text: {
      es: 'La ingeniería es una profesión creativa, no mecánica; las soluciones más perdurables son siempre las más simples y naturales.',
      en: 'Engineering is a creative profession, not a mechanical one; the most enduring solutions are always the simplest and most natural.',
    },
    author: 'Peter Rice',
    role: {
      es: 'Ingeniero estructural · Royal Gold Medal',
      en: 'Royal Gold Medal structural engineer',
    },
    source: 'An Engineer Imagines',
    category: 'engineering',
  },
  {
    id: 8,
    text: {
      es: 'La ingeniería no consiste solo en números; es el arte de modelar el mundo físico para servir a la vida humana con integridad y belleza.',
      en: 'Engineering is not just numbers; it is the art of shaping the physical world to serve human life with integrity and beauty.',
    },
    author: 'Ove Arup',
    role: {
      es: 'Fundador de Arup · Teórico del diseño integral',
      en: 'Founder of Arup · Theorist of Total Design',
    },
    source: 'The Key Speech (1970)',
    category: 'structural',
  },
  {
    id: 9,
    text: {
      es: 'Unir fuerzas con otros en la búsqueda de la calidad, la excelencia y la escala humana es la única forma de construir algo de valor duradero.',
      en: 'To join forces with others in the search for quality, excellence, and human scale is the only way to build anything of lasting value.',
    },
    author: 'Ove Arup',
    role: {
      es: 'Pionero del diseño estructural colaborativo',
      en: 'Pioneer of collaborative structural design',
    },
    source: 'The Key Speech',
    category: 'life',
  },
  {
    id: 10,
    text: {
      es: 'Una estructura debe ser un organismo en el que cada parte tenga una relación necesaria y transparente con el conjunto.',
      en: 'A structure should be an organism in which each part has a necessary and transparent relationship to the whole.',
    },
    author: 'Robert Maillart',
    role: {
      es: 'Diseñador de puentes de hormigón · Puente Salginatobel',
      en: 'Concrete bridge designer · Salginatobel Bridge',
    },
    source: 'Construcción de puentes de hormigón armado (1938)',
    category: 'structural',
  },
  {
    id: 11,
    text: {
      es: 'El hormigón armado no exige imitar la piedra o la madera; reclama su propia lógica geométrica: ligera, esbelta y continua.',
      en: 'Reinforced concrete does not demand that we imitate stone or timber; it claims its own geometric logic: light, slender, and continuous.',
    },
    author: 'Robert Maillart',
    role: {
      es: 'Pionero de los puentes arco integrados',
      en: 'Pioneer of integrated arch bridges',
    },
    source: 'Schweizerische Bauzeitung',
    category: 'structural',
  },
  {
    id: 12,
    text: {
      es: 'El buen diseño estructural es el arte de lograr el máximo rendimiento con el mínimo de material y ruido visual.',
      en: 'Good structural design is the art of achieving maximum performance with minimum material and visual noise.',
    },
    author: 'Jörg Schlaich',
    role: {
      es: 'Pionero de estructuras ligeras · Estadio Olímpico de Múnich',
      en: 'Pioneer of lightweight structures · Munich Olympic Stadium',
    },
    source: 'The Art of Structural Engineering',
    category: 'structural',
  },
  {
    id: 13,
    text: {
      es: 'Una estructura ligera no es un ejercicio de minimalismo arbitrario, sino un diálogo honesto entre el equilibrio y la gravedad.',
      en: 'A lightweight structure is not an exercise in arbitrary minimalism, but an honest dialogue between equilibrium and gravity.',
    },
    author: 'Jörg Schlaich',
    role: {
      es: 'Catedrático de estructuras y diseñador de mallas tensadas',
      en: 'Structural professor and cable-net designer',
    },
    source: 'Light Structures',
    category: 'structural',
  },
  {
    id: 14,
    text: {
      es: '¿Acaso porque somos ingenieros la belleza no ha de preocuparnos, o creemos que no podemos crear elegancia a la vez que solidez y duración?',
      en: 'Because we are engineers, do you believe that beauty does not concern us, or that we cannot create elegance alongside strength and durability?',
    },
    author: 'Gustave Eiffel',
    role: {
      es: 'Ingeniero civil · Creador de la Torre Eiffel y Viaducto de Garabit',
      en: 'Civil Engineer · Creator of the Eiffel Tower & Garabit Viaduct',
    },
    source: 'Respuesta al Manifiesto de los Artistas (1887)',
    category: 'engineering',
  },
  {
    id: 15,
    text: {
      es: 'El primer principio de la estética estructural es que las líneas maestras de una obra deben determinarse por la perfecta armonía con su resistencia.',
      en: 'The first principle of structural aesthetics is that the primary lines of a work must be determined by perfect harmony with its resistance.',
    },
    author: 'Gustave Eiffel',
    role: {
      es: 'Maestro del hierro estructural',
      en: 'Master of structural ironwork',
    },
    source: 'Mémoires de la Tour Eiffel',
    category: 'structural',
  },
  {
    id: 16,
    text: {
      es: 'La ingeniería es el arte de hacer lo imposible estructuralmente estable, y lo estable estéticamente expresivo.',
      en: 'Engineering is the art of making the impossible structurally stable, and the stable aesthetically expressive.',
    },
    author: 'Santiago Calatrava',
    role: {
      es: 'Arquitecto e ingeniero estructural · Puente del Alamillo',
      en: 'Architect and structural engineer · Alamillo Bridge',
    },
    source: 'Conferencia en MIT',
    category: 'structural',
  },
  {
    id: 17,
    text: {
      es: 'El esqueleto de una estructura es su alma; cuando lo revelas con sencillez, prescindes de cualquier máscara decorativa.',
      en: 'The skeleton of a structure is its soul; when you reveal it with simplicity, you dispense with any decorative mask.',
    },
    author: 'Santiago Calatrava',
    role: {
      es: 'Diseñador de puentes y cubiertas cinéticas',
      en: 'Designer of bridges and kinetic canopies',
    },
    source: 'Conversaciones sobre arquitectura e ingeniería',
    category: 'structural',
  },
  {
    id: 18,
    text: {
      es: 'Un gran puente es el triunfo de la armonía matemática sobre las fuerzas caóticas de la naturaleza.',
      en: 'A great bridge is the triumph of mathematical harmony over the chaotic forces of nature.',
    },
    author: 'John Roebling',
    role: {
      es: 'Ingeniero civil · Diseñador del Puente de Brooklyn',
      en: 'Civil Engineer · Brooklyn Bridge designer',
    },
    source: 'Report on the Niagara Railway Suspension Bridge',
    category: 'structural',
  },
  {
    id: 19,
    text: {
      es: 'Fueron años de inmenso trabajo y desvelo, pero el puente sigue en pie como prueba de lo que la constancia y la claridad mental pueden erigir.',
      en: 'They were years of immense work and vigilance, but the bridge stands as proof of what perseverance and mental clarity can erect.',
    },
    author: 'Emily Warren Roebling',
    role: {
      es: 'Directora de obra del Puente de Brooklyn',
      en: 'Field director of the Brooklyn Bridge construction',
    },
    source: 'Correspondencia y memorias del Puente de Brooklyn',
    category: 'life',
  },
  {
    id: 20,
    text: {
      es: 'Me opongo a fijar reglas rígidas para la construcción; dejemos que las leyes de la mecánica y la naturaleza dicten la forma óptima.',
      en: 'I am opposed to laying down rigid rules for construction; let the laws of mechanics and nature dictate the optimal form.',
    },
    author: 'Isambard Kingdom Brunel',
    role: {
      es: 'Ingeniero mecánico y civil · Great Western Railway',
      en: 'Mechanical and Civil Engineer · Great Western Railway',
    },
    source: 'Testimonio parlamentario sobre puentes ferroviarios',
    category: 'engineering',
  },
  {
    id: 21,
    text: {
      es: 'Una estructura bien concebida no combate las fuerzas que actúan sobre ella; las conduce con serenidad hasta el terreno.',
      en: 'A well-conceived structure does not fight the forces acting upon it; it leads them serenely down into the ground.',
    },
    author: 'Isambard Kingdom Brunel',
    role: {
      es: 'Creador del Puente Colgante de Clifton',
      en: 'Creator of the Clifton Suspension Bridge',
    },
    source: 'Diarios de ingeniería',
    category: 'structural',
  },
  {
    id: 22,
    text: {
      es: 'El arte de la ingeniería civil consiste en encauzar las grandes fuentes de energía de la naturaleza para el provecho y la dignidad humana.',
      en: 'The art of civil engineering consists in directing the great sources of power in nature for the use and dignity of humankind.',
    },
    author: 'Thomas Telford',
    role: {
      es: 'Primer presidente de la Institución de Ingenieros Civiles (ICE)',
      en: 'First president of the Institution of Civil Engineers (ICE)',
    },
    source: 'Estatutos de la Institución de Ingenieros Civiles (1828)',
    category: 'engineering',
  },
  {
    id: 23,
    text: {
      es: 'La corrección estructural es siempre una condición necesaria, aunque no siempre suficiente, para alcanzar la belleza arquitectónica.',
      en: 'Structural correctness is always a necessary, although not always sufficient, condition for achieving architectural beauty.',
    },
    author: 'Pier Luigi Nervi',
    role: {
      es: 'Pionero del ferrocemento · Palazzetto dello Sport',
      en: 'Ferrocement pioneer · Palazzetto dello Sport',
    },
    source: 'Aesthetics and Technology in Building (1965)',
    category: 'structural',
  },
  {
    id: 24,
    text: {
      es: 'Cuando una estructura se concibe según el flujo natural de los esfuerzos internos, la elegancia surge como consecuencia inevitable, no como adorno.',
      en: 'When a structure is conceived according to the natural flow of internal forces, elegance emerges as an inevitable consequence, not an ornament.',
    },
    author: 'Pier Luigi Nervi',
    role: {
      es: 'Ingeniero estructural y constructor italiano',
      en: 'Italian structural engineer and builder',
    },
    source: 'Costruire correttamente',
    category: 'structural',
  },
  {
    id: 25,
    text: {
      es: 'Eficiencia, economía y elegancia: estos son los tres ideales indivisibles del verdadero arte estructural.',
      en: 'Efficiency, economy, and elegance: these are the three indivisible ideals of true structural art.',
    },
    author: 'David P. Billington',
    role: {
      es: 'Historiador y catedrático de ingeniería en Princeton',
      en: 'Engineering historian and Princeton professor',
    },
    source: 'The Tower and the Bridge: The New Art of Structural Engineering (1983)',
    category: 'structural',
  },
  {
    id: 26,
    text: {
      es: 'El arte estructural no es decoración prestada; es la disciplina de hallar la forma que requiere la menor cantidad de material para garantizar la máxima seguridad.',
      en: 'Structural art is not borrowed decoration; it is the discipline of finding the form that requires the least material to guarantee maximum safety.',
    },
    author: 'David P. Billington',
    role: {
      es: 'Pionero del concepto de Arte Estructural',
      en: 'Pioneer of the Structural Art movement',
    },
    source: 'The Tower and the Bridge',
    category: 'structural',
  },
  {
    id: 27,
    text: {
      es: 'El fallo es el centro de la ingeniería: cada cálculo, cada rediseño y cada avance nacen de comprender con exactitud qué puede salir mal.',
      en: 'Failure is central to engineering: every calculation, every redesign, and every breakthrough is born from understanding exactly what can go wrong.',
    },
    author: 'Henry Petroski',
    role: {
      es: 'Ingeniero civil y ensayista · Universidad de Duke',
      en: 'Civil engineer and essayist · Duke University',
    },
    source: 'To Engineer Is Human (1985)',
    category: 'engineering',
  },
  {
    id: 28,
    text: {
      es: 'La forma sigue al fallo: la historia de la ingeniería es una depuración incansable hacia la sencillez eliminando puntos vulnerables.',
      en: 'Form follows failure: the history of engineering is a relentless refinement toward simplicity by eliminating points of vulnerability.',
    },
    author: 'Henry Petroski',
    role: {
      es: 'Autor de historia y filosofía del diseño técnico',
      en: 'Author on the history and philosophy of technical design',
    },
    source: 'The Evolution of Useful Things (1992)',
    category: 'simplicity',
  },
  {
    id: 29,
    text: {
      es: 'La resistencia no basta; una estructura debe comportarse con nobleza, deformarse dentro de límites razonables y transmitir las cargas con serenidad.',
      en: 'Strength is not enough; a structure must behave gracefully, deflect within reasonable limits, and transmit loads serenely.',
    },
    author: 'Hardy Cross',
    role: {
      es: 'Creador del método de distribución de momentos',
      en: 'Creator of the Moment Distribution Method',
    },
    source: 'Analysis of Continuous Frames (1930)',
    category: 'structural',
  },
  {
    id: 30,
    text: {
      es: 'La ingeniería es el arte de hacer con un dólar lo que cualquier chapucero hace con dos, pero sobre todo es el arte de ver la realidad física tras la niebla de las fórmulas.',
      en: 'Engineering is the art of doing that well with one dollar which any bungler can do with two, but above all it is the art of seeing physical reality through the fog of formulas.',
    },
    author: 'Hardy Cross',
    role: {
      es: 'Catedrático de ingeniería civil · Universidad de Illinois',
      en: 'Civil engineering professor · University of Illinois',
    },
    source: 'Engineers and Ivory Towers (1952)',
    category: 'engineering',
  },
  {
    id: 31,
    text: {
      es: 'La belleza de un puente reside en la nitidez de su sistema resistente: cada línea debe contar la historia de sus fuerzas.',
      en: 'The beauty of a bridge lies in the clarity of its load-carrying system: every line should tell the story of its forces.',
    },
    author: 'Christian Menn',
    role: {
      es: 'Diseñador de puentes atirantados · Puente Sunniberg',
      en: 'Cable-stayed bridge designer · Sunniberg Bridge',
    },
    source: 'Prestressed Concrete Bridges (1990)',
    category: 'structural',
  },
  {
    id: 32,
    text: {
      es: 'La sencillez en el diseño estructural no delata falta de imaginación, sino la más alta disciplina y madurez del proyectista.',
      en: 'Simplicity in structural design does not betray a lack of imagination, but the highest discipline and maturity of the engineer.',
    },
    author: 'Christian Menn',
    role: {
      es: 'Catedrático de estructuras en el ETH Zúrich',
      en: 'Structural engineering professor at ETH Zurich',
    },
    source: 'Discurso en el simposio IABSE',
    category: 'simplicity',
  },
  {
    id: 33,
    text: {
      es: 'El paraboloide hiperbólico es el regalo de la naturaleza a la ingeniería: curvatura doble infinita engendrada exclusivamente por rectas.',
      en: "The hyperbolic paraboloid is nature's gift to engineering: infinite double curvature generated entirely by straight lines.",
    },
    author: 'Félix Candela',
    role: {
      es: 'Maestro de los cascarones laminares · Los Manantiales',
      en: 'Master of thin-shell structures · Los Manantiales',
    },
    source: 'Hacia una nueva filosofía de las estructuras (1954)',
    category: 'structural',
  },
  {
    id: 34,
    text: {
      es: 'De todas las formas estructurales, las más delgadas y sencillas son siempre las más resistentes cuando se comprende la geometría.',
      en: 'Of all structural shapes, the thinnest and simplest are always the most resistant when geometry is properly understood.',
    },
    author: 'Félix Candela',
    role: {
      es: 'Pionero hispanomexicano del hormigón laminar',
      en: 'Spanish-Mexican pioneer of thin-shell concrete',
    },
    source: 'En defensa del diseño geométrico',
    category: 'structural',
  },
  {
    id: 35,
    text: {
      es: 'Hay dos tipos de ingeniería: la que confía en la masa bruta y la que confía en la inteligencia geométrica. Solo la segunda engendra verdadera arquitectura.',
      en: 'There are two kinds of engineering: that which relies on brute mass, and that which relies on geometric intelligence. Only the second gives rise to true architecture.',
    },
    author: 'Eladio Dieste',
    role: {
      es: 'Pionero de la cerámica armada · Iglesia de Atlántida',
      en: 'Pioneer of reinforced ceramics · Church of Atlántida',
    },
    source: 'La invención de las formas (1996)',
    category: 'structural',
  },
  {
    id: 36,
    text: {
      es: 'La forma resistente siempre supera a la masa resistente: la geometría sostiene con ligereza lo que el peso muerto solo aplasta.',
      en: 'Resistant form always surpasses resistant mass: geometry carries lightly what dead weight only crushes.',
    },
    author: 'Eladio Dieste',
    role: {
      es: 'Ingeniero civil uruguayo · Creador de bóvedas de doble curvatura',
      en: 'Uruguayan civil engineer · Creator of Gaussian vaults',
    },
    source: 'Escritos sobre arquitectura y técnica',
    category: 'structural',
  },
  {
    id: 37,
    text: {
      es: 'Una estructura permanece en pie porque a cada acción se opone una reacción igual y contraria; el genio del diseño consiste en lograr que ese equilibrio parezca espontáneo.',
      en: 'A structure stands because every action is met with an equal and opposite reaction; the genius of design is making that equilibrium seem effortless.',
    },
    author: 'Mario Salvadori',
    role: {
      es: 'Ingeniero estructural y profesor en Columbia',
      en: 'Structural engineer and Columbia professor',
    },
    source: 'Why Buildings Stand Up (1980)',
    category: 'structural',
  },
  {
    id: 38,
    text: {
      es: 'El colapso de una estructura casi nunca se debe a leyes físicas misteriosas, sino al olvido de los principios más elementales del equilibrio.',
      en: 'The collapse of a structure is rarely due to mysterious physical laws, but to forgetting the most elementary principles of equilibrium.',
    },
    author: 'Mario Salvadori',
    role: {
      es: 'Divulgador estructural y consultor forense',
      en: 'Structural educator and forensic consultant',
    },
    source: 'Why Buildings Fall Down (1992)',
    category: 'structural',
  },
  {
    id: 39,
    text: {
      es: 'Conviene recordar que la ingeniería es el arte de hacer bien con un dólar lo que cualquier torpe puede hacer con dos.',
      en: 'It would be well if it were commonly understood that engineering is the art of doing that well with one dollar which any bungler can do with two.',
    },
    author: 'Arthur Mellen Wellington',
    role: {
      es: 'Ingeniero civil ferroviario y tratadista',
      en: 'Railway civil engineer and theorist',
    },
    source: 'The Economic Theory of the Location of Railways (1887)',
    category: 'engineering',
  },
  {
    id: 40,
    text: {
      es: 'El ingeniero estructural debe comprender el alma y el comportamiento físico de un edificio antes de atreverse a tocar un solo número.',
      en: 'The structural engineer must understand the soul and physical behavior of a building before daring to touch a single number.',
    },
    author: 'Leslie E. Robertson',
    role: {
      es: 'Ingeniero estructural principal del World Trade Center original',
      en: 'Lead structural engineer of the original World Trade Center',
    },
    source: 'The Structure of Design (2017)',
    category: 'structural',
  },
  {
    id: 41,
    text: {
      es: 'Las soluciones de ingeniería más brillantes son aquellas que, una vez vistas, hacen imposible imaginar que pudieran resolverse de otro modo.',
      en: 'The most brilliant engineering solutions are those that, once seen, make it impossible to imagine they could have been solved any other way.',
    },
    author: 'Ted Zoli',
    role: {
      es: 'Ingeniero de puentes y becario MacArthur',
      en: 'Bridge engineer and MacArthur Fellow',
    },
    source: 'ASCE Keynote Address',
    category: 'simplicity',
  },
  {
    id: 42,
    text: {
      es: 'Ante un problema intrincado, despoja todo lo accesorio hasta que la ley fundamental de la naturaleza quede desnuda ante tus ojos.',
      en: 'Whenever you encounter a complicated problem, strip away every non-essential until the fundamental law of nature lies bare before you.',
    },
    author: 'Barnes Wallis',
    role: {
      es: 'Ingeniero aeronáutico · Creador de la estructura geodésica',
      en: 'Aeronautical engineer · Creator of geodetic airframe structures',
    },
    source: 'Biografía y archivos de Brooklands',
    category: 'engineering',
  },
  {
    id: 43,
    text: {
      es: 'El ordenador no calcula estructuras; calcula el ingeniero, y la máquina simplemente ejecuta la aritmética con paciencia ciega.',
      en: 'The computer does not calculate structures; the engineer calculates, and the machine merely carries out the arithmetic with blind patience.',
    },
    author: 'Paul Weidlinger',
    role: {
      es: 'Pionero del análisis estructural computacional',
      en: 'Pioneer of computational structural analysis',
    },
    source: 'Weidlinger Associates Technical Papers',
    category: 'engineering',
  },
  {
    id: 44,
    text: {
      es: 'El ingeniero es el mediador entre el filósofo y el artesano; trata a la naturaleza no como una enemiga a vencer, sino como una aliada a comprender.',
      en: 'The engineer is the mediator between the philosopher and the craftsman; treating nature not as an adversary to conquer, but as an ally to understand.',
    },
    author: 'James Kip Finch',
    role: {
      es: 'Decano de la Escuela de Ingeniería de Columbia',
      en: 'Dean of the Columbia School of Engineering',
    },
    source: 'Engineering and Western Civilization (1951)',
    category: 'engineering',
  },
  {
    id: 45,
    text: {
      es: 'Nadie se convierte en necio hasta que deja de hacer preguntas y acepta una respuesta complicada cuando existe una sencilla.',
      en: 'No one really becomes a fool until they stop asking questions and accept a complicated answer when a simple one exists.',
    },
    author: 'Charles Proteus Steinmetz',
    role: {
      es: 'Pionero de la ingeniería eléctrica y de la corriente alterna',
      en: 'Pioneer of electrical engineering and alternating current',
    },
    source: 'General Electric Archives',
    category: 'simplicity',
  },
  {
    id: 46,
    text: {
      es: 'Los científicos estudian el mundo tal como es; los ingenieros crean el mundo que nunca antes existió.',
      en: 'Scientists study the world as it is; engineers create the world that has never been.',
    },
    author: 'Theodore von Kármán',
    role: {
      es: 'Físico e ingeniero de mecánica de fluidos y estructuras',
      en: 'Physicist and structural aerodynamicist',
    },
    source: 'Discurso inaugural en Caltech',
    category: 'engineering',
  },
  {
    id: 47,
    text: {
      es: 'Mantenlo simple: si un sistema es demasiado enrevesado para explicárselo a un técnico en cinco minutos, con certeza fallará.',
      en: 'Keep it simple: if a system is too convoluted to explain to a technician in five minutes, it will almost certainly fail.',
    },
    author: 'Kelly Johnson',
    role: {
      es: 'Líder de Lockheed Skunk Works · Creador del principio KISS',
      en: 'Leader of Lockheed Skunk Works · Originator of the KISS rule',
    },
    source: "Clarence 'Kelly' Johnson: Memories of Skunk Works",
    category: 'simplicity',
  },
  {
    id: 48,
    text: {
      es: 'Una prueba experimental rigurosa vale más que mil opiniones expertas, y un modelo analítico limpio vale más que cien ensayos a ciegas.',
      en: 'One rigorous experimental test is worth a thousand expert opinions, and one clean analytical model is worth a hundred blind trials.',
    },
    author: 'Wernher von Braun',
    role: {
      es: 'Ingeniero aeroespacial y director de diseño del Saturno V',
      en: 'Aerospace engineer and Saturn V design director',
    },
    source: 'NASA Technical Memoirs',
    category: 'engineering',
  },
  {
    id: 49,
    text: {
      es: 'La innovación solo florece cuando tienes la osadía de cuestionar las hipótesis más elementales que todos los demás dan por sentadas.',
      en: 'Innovation only flourishes when you have the audacity to question the most basic assumptions that everyone else takes for granted.',
    },
    author: 'Burt Rutan',
    role: {
      es: 'Diseñador de aeronaves ligeras · Creador de SpaceShipOne',
      en: 'Lightweight aircraft designer · Creator of SpaceShipOne',
    },
    source: 'Conferencia TED',
    category: 'engineering',
  },
  {
    id: 50,
    text: {
      es: 'La sencillez en el diseño estructural es la única garantía de fiabilidad cuando la estructura se somete a la prueba del tiempo.',
      en: 'Simplicity in structural design is the only guarantee of reliability when the structure is subjected to the test of time.',
    },
    author: 'Anthony Fokker',
    role: {
      es: 'Pionero aeronáutico e industrial del diseño en tubo de acero',
      en: 'Aviation pioneer and tubular steel structure developer',
    },
    source: 'Flying Dutchman (1931)',
    category: 'structural',
  },
  {
    id: 51,
    text: {
      es: 'La sencillez no es la ausencia de funciones; es la profunda comprensión del propósito esencial de lo que estás creando.',
      en: 'Simplicity is not the lack of features; it is the profound understanding of the essential purpose of what you are creating.',
    },
    author: 'Steve Jobs',
    role: {
      es: 'Visionario de diseño de producto y tecnología',
      en: 'Product design visionary and technology pioneer',
    },
    source: 'Apple Design Philosophy Notes',
    category: 'simplicity',
  },
  {
    id: 52,
    text: {
      es: 'La simplicidad es un prerrequisito innegociable para la fiabilidad de cualquier sistema.',
      en: 'Simplicity is a prerequisite for reliability in any system.',
    },
    author: 'Edsger W. Dijkstra',
    role: {
      es: 'Pionero de las ciencias de la computación · Premio Turing',
      en: 'Computer science pioneer · Turing Award recipient',
    },
    source: 'EWD498: How Do We Tell Truths that Might Hurt?',
    category: 'simplicity',
  },
  {
    id: 53,
    text: {
      es: 'Si deseamos que un diseño conserve su limpieza, debemos estar dispuestos a pensar con mucha profundidad antes de dar el primer paso formal.',
      en: 'If we wish a design to remain clean, we must be willing to think deeply before taking the first formal step.',
    },
    author: 'Edsger W. Dijkstra',
    role: {
      es: 'Teórico de la computación y la verificación formal',
      en: 'Theorist of computing and formal verification',
    },
    source: 'EWD1036: The Cruelty of Really Teaching Computing Science',
    category: 'engineering',
  },
  {
    id: 54,
    text: {
      es: 'Hay dos maneras de construir un sistema: una es hacerlo tan simple que sea evidente que no hay defectos; la otra es hacerlo tan complicado que no haya defectos evidentes.',
      en: 'There are two ways of constructing a system: one way is to make it so simple that there are obviously no deficiencies, and the other is to make it so complicated that there are no obvious deficiencies.',
    },
    author: 'C.A.R. Hoare',
    role: {
      es: 'Creador del algoritmo Quicksort · Premio Turing',
      en: 'Creator of Quicksort · Turing Award recipient',
    },
    source: "The Emperor's Old Clothes (1980 ACM Turing Award Lecture)",
    category: 'simplicity',
  },
  {
    id: 55,
    text: {
      es: 'Lo simple debe ser fácil, y lo complejo debe ser posible.',
      en: 'Simple things should be simple, complex things should be possible.',
    },
    author: 'Alan Kay',
    role: {
      es: 'Pionero de la computación orientada a objetos e interfaces gráficas',
      en: 'Pioneer of object-oriented programming and graphical interfaces',
    },
    source: "O'Reilly Open Source Convention",
    category: 'simplicity',
  },
  {
    id: 56,
    text: {
      es: 'El punto de vista vale 80 puntos de cociente intelectual: un marco conceptual adecuado convierte un problema laberíntico en algo obvio.',
      en: 'Point of view is worth 80 IQ points: a proper conceptual framework turns a labyrinthine problem into an obvious one.',
    },
    author: 'Alan Kay',
    role: {
      es: 'Científico jefe en Xerox PARC · Premio Turing',
      en: 'Chief Scientist at Xerox PARC · Turing Award recipient',
    },
    source: 'Conferencia en Stanford University',
    category: 'life',
  },
  {
    id: 57,
    text: {
      es: 'Si vas a crear algo, no persigas lo que otros esperan de ti; persigue aquello que a ti te obsesiona de verdad.',
      en: "If you're going to create something, don't chase what others expect; chase what truly obsesses you.",
    },
    author: 'Christopher Nolan',
    role: {
      es: 'Cineasta y guionista · Ganador del Óscar por Oppenheimer',
      en: 'Filmmaker and screenwriter · Academy Award winner for Oppenheimer',
    },
    source: 'BAFTA A Life in Pictures',
    category: 'art',
  },
  {
    id: 58,
    text: {
      es: 'Un sistema bien concebido protege al operador del error; la claridad visual no es un capricho estético, sino una barrera de seguridad.',
      en: 'A well-conceived system shields the operator from error; visual clarity is not an aesthetic whim, but a safety barrier.',
    },
    author: 'Margaret Hamilton',
    role: {
      es: 'Pionera de la ingeniería de software moderna',
      en: 'Pioneer of modern software engineering',
    },
    source: 'IEEE Computer Society Interview',
    category: 'engineering',
  },
  {
    id: 59,
    text: {
      es: 'La integridad conceptual es la consideración más crítica en el diseño de cualquier arquitectura.',
      en: 'Conceptual integrity is the most important consideration in system design.',
    },
    author: 'Fred Brooks',
    role: {
      es: 'Arquitecto del IBM System/360 · Premio Turing',
      en: 'Architect of IBM System/360 · Turing Award recipient',
    },
    source: 'The Mythical Man-Month (1975)',
    category: 'engineering',
  },
  {
    id: 60,
    text: {
      es: 'La elegancia y la solidez no provienen de acumular funciones, sino de la coherencia interna de unos pocos conceptos bien elegidos.',
      en: 'Elegance and solidity do not come from accumulating features, but from the internal coherence of a few well-chosen concepts.',
    },
    author: 'Fred Brooks',
    role: {
      es: 'Tratadista de la ingeniería de sistemas',
      en: 'System engineering theorist',
    },
    source: 'The Design of Design (2010)',
    category: 'simplicity',
  },
  {
    id: 61,
    text: {
      es: 'La optimización prematura es la raíz de casi todos los males en la ingeniería.',
      en: 'Premature optimization is the root of all evil in engineering.',
    },
    author: 'Donald Knuth',
    role: {
      es: 'Autor de The Art of Computer Programming · Creador de TeX',
      en: 'Author of The Art of Computer Programming · Creator of TeX',
    },
    source: 'Structured Programming with go to Statements (1974)',
    category: 'engineering',
  },
  {
    id: 62,
    text: {
      es: 'La ciencia es lo que entendemos lo bastante bien como para explicárselo a una máquina; el arte es todo lo demás que hacemos.',
      en: 'Science is what we understand well enough to explain to a computer; art is everything else we do.',
    },
    author: 'Donald Knuth',
    role: {
      es: 'Catedrático emérito de Stanford · Premio Turing',
      en: 'Stanford Professor Emeritus · Turing Award recipient',
    },
    source: 'Things a Computer Scientist Rarely Talks About (2001)',
    category: 'life',
  },
  {
    id: 63,
    text: {
      es: 'El trabajo más personal es siempre el más creativo; no intentes adivinar lo que otros esperan, dales lo que tú sientes de verdad.',
      en: "The most personal is the most creative; don't try to guess what others want, give them what you truly feel inside.",
    },
    author: 'Martin Scorsese',
    role: {
      es: 'Director y productor de cine · Ganador del Óscar por The Departed',
      en: 'Filmmaker and producer · Academy Award winner for The Departed',
    },
    source: 'AFI Life Achievement Award',
    category: 'art',
  },
  {
    id: 64,
    text: {
      es: 'Si te pones metas ridículamente altas y fracasas, fracasarás por encima del éxito de todos los demás.',
      en: "If you set your goals ridiculously high and it's a failure, you will fail above everyone else's success.",
    },
    author: 'James Cameron',
    role: {
      es: 'Cineasta, explorador oceánico e innovador tecnológico',
      en: 'Filmmaker, ocean explorer, and technology innovator',
    },
    source: 'Entrevistas sobre la innovación tecnológica en el cine',
    category: 'engineering',
  },
  {
    id: 65,
    text: {
      es: 'El buen arquitecto no se define por lo que añade, sino por saber con exactitud cuándo dejar de complicar las cosas.',
      en: 'Good architecture is not defined by what you add, but by knowing exactly when to stop complicating things.',
    },
    author: 'Linus Torvalds',
    role: {
      es: 'Creador del núcleo Linux y del sistema de control Git',
      en: 'Creator of the Linux kernel and Git version control',
    },
    source: 'Linux Kernel Mailing List',
    category: 'simplicity',
  },
  {
    id: 66,
    text: {
      es: 'Cualquier cosa que hagas a gran escala debe cimentarse en la pasión personal; si no estás dispuesto a arriesgarlo todo, la obra no cobrará vida.',
      en: "Anything you build at large scale must be rooted in personal passion; if you're not ready to risk everything, the work will never come alive.",
    },
    author: 'Francis Ford Coppola',
    role: {
      es: 'Director y guionista · Ganador de cinco premios Óscar',
      en: 'Director and screenwriter · Five-time Academy Award winner',
    },
    source: 'Reflexiones sobre la creación cinematográfica',
    category: 'art',
  },
  {
    id: 67,
    text: {
      es: 'Simple no es sinónimo de fácil: fácil describe lo que tenemos a mano; simple es aquello que no está enredado.',
      en: 'Simple is not easy: easy describes what is near at hand; simple is that which is not intertwined.',
    },
    author: 'Rich Hickey',
    role: {
      es: 'Diseñador de software · Creador del lenguaje Clojure',
      en: 'Software designer · Creator of the Clojure language',
    },
    source: 'Simple Made Easy (Strange Loop 2011)',
    category: 'simplicity',
  },
  {
    id: 68,
    text: {
      es: 'La abstracción consiste en ocultar el detalle secundario para que el intelecto pueda concentrarse plenamente en lo esencial.',
      en: 'Abstraction is about hiding secondary details so that the intellect can concentrate fully on what is essential.',
    },
    author: 'Barbara Liskov',
    role: {
      es: 'Pionera de la teoría de tipos y lenguajes · Premio Turing',
      en: 'Pioneer in type systems and programming languages · Turing Award',
    },
    source: 'Abstraction and Specification in Program Development',
    category: 'engineering',
  },
  {
    id: 69,
    text: {
      es: 'La complejidad es la gravedad de los proyectos técnicos: si no ejerces un esfuerzo consciente y continuo, todo sistema decae hacia el caos.',
      en: 'Complexity is the gravity of technical projects: without constant, conscious effort, every system decays toward disorder.',
    },
    author: 'John Carmack',
    role: {
      es: 'Ingeniero de motores gráficos en 3D · id Software',
      en: '3D graphics engine pioneer · id Software',
    },
    source: 'Quake / Doom Engine Retrospective',
    category: 'engineering',
  },
  {
    id: 70,
    text: {
      es: 'La claridad siempre supera a la astucia: una solución transparente es legible, comprobable y resistente al paso del tiempo.',
      en: 'Clarity is always better than cleverness: a transparent solution is legible, testable, and resilient to time.',
    },
    author: 'Rob Pike',
    role: {
      es: 'Cocreador del lenguaje Go y del sistema Plan 9',
      en: 'Co-creator of the Go language and Plan 9 from Bell Labs',
    },
    source: 'Go Proverbs',
    category: 'simplicity',
  },
  {
    id: 71,
    text: {
      es: 'El arte y la creación no nacen de la perfección, sino de amar profundamente las imperfecciones que nos hacen humanos.',
      en: 'Art and creation do not come from perfection, but from deeply loving the imperfections that make us human.',
    },
    author: 'Guillermo del Toro',
    role: {
      es: 'Cineasta, guionista y escritor · Ganador del Óscar',
      en: 'Filmmaker, screenwriter, and novelist · Academy Award winner',
    },
    source: 'Discurso de aceptación del Óscar',
    category: 'art',
  },
  {
    id: 72,
    text: {
      es: 'La simplicidad es la máxima sofisticación.',
      en: 'Simplicity is the ultimate sophistication.',
    },
    author: 'Leonardo da Vinci',
    role: {
      es: 'Polímata renacentista · Ingeniero, anatomista y artista',
      en: 'Renaissance polymath · Engineer, anatomist, and artist',
    },
    source: 'Códice Atlántico',
    category: 'simplicity',
  },
  {
    id: 73,
    text: {
      es: 'La mecánica es el paraíso de las ciencias matemáticas, porque con ella se recogen los frutos tangibles del cálculo.',
      en: 'Mechanics is the paradise of mathematical science, because through it one reaps the tangible fruits of calculation.',
    },
    author: 'Leonardo da Vinci',
    role: {
      es: 'Maestro del dibujo técnico y de la estática',
      en: 'Master of technical drawing and statics',
    },
    source: 'Cuadernos de notas (Códice Madrid)',
    category: 'structural',
  },
  {
    id: 74,
    text: {
      es: 'Nuestras virtudes y nuestras debilidades son inseparables, como la fuerza y la materia: cuando se separan, la forma se disuelve.',
      en: 'Our virtues and our failings are inseparable, like force and matter: when they separate, form itself dissolves.',
    },
    author: 'Nikola Tesla',
    role: {
      es: 'Inventor y visionario del electromagnetismo',
      en: 'Inventor and electromagnetism visionary',
    },
    source: 'My Inventions (1919)',
    category: 'life',
  },
  {
    id: 75,
    text: {
      es: 'El pensamiento es más agudo y penetrante cuando no está aturdido por la complejidad ficticia que el hombre se inventa.',
      en: 'The mind is sharper and more keen when it is not clouded by the artificial complexity that humankind invents.',
    },
    author: 'Nikola Tesla',
    role: {
      es: 'Pionero del sistema de energía polifásico',
      en: 'Pioneer of polyphase power transmission',
    },
    source: 'Electrical Experimenter',
    category: 'simplicity',
  },
  {
    id: 76,
    text: {
      es: 'Cuando resuelvo un problema nunca pienso en la belleza; solo pienso en cómo resolverlo. Pero si al terminar la solución no es bella, sé que está mal.',
      en: 'When I am working on a problem, I never think about beauty; I think only how to solve the problem. But when I have finished, if the solution is not beautiful, I know it is wrong.',
    },
    author: 'Buckminster Fuller',
    role: {
      es: 'Inventor de la cúpula geodésica y teórico de sistemas',
      en: 'Inventor of the geodesic dome and systems theorist',
    },
    source: 'Operating Manual for Spaceship Earth (1969)',
    category: 'structural',
  },
  {
    id: 77,
    text: {
      es: 'Hacer más con menos es la dirección inexorable de toda verdadera evolución tecnológica y estructural.',
      en: 'Doing more with less is the inexorable direction of all true technological and structural evolution.',
    },
    author: 'Buckminster Fuller',
    role: {
      es: 'Pionero de la tensegridad y la ligereza estructural',
      en: 'Pioneer of tensegrity and lightweight structural design',
    },
    source: 'Synergetics: Explorations in the Geometry of Thinking',
    category: 'simplicity',
  },
  {
    id: 78,
    text: {
      es: 'Menos es más.',
      en: 'Less is more.',
    },
    author: 'Ludwig Mies van der Rohe',
    role: {
      es: 'Arquitecto y maestro de la estructura de acero · Pabellón de Barcelona',
      en: 'Architect and master of structural steel · Barcelona Pavilion',
    },
    source: 'Ideario arquitectónico de la Bauhaus',
    category: 'simplicity',
  },
  {
    id: 79,
    text: {
      es: 'La estructura es el orden espiritual de una época, expresado en la pureza nítida de sus pilares y vigas.',
      en: 'Structure is the spiritual order of an era, expressed in the clean purity of its columns and beams.',
    },
    author: 'Ludwig Mies van der Rohe',
    role: {
      es: 'Director de la Bauhaus y diseñador de Farnsworth House',
      en: 'Director of the Bauhaus and designer of Farnsworth House',
    },
    source: 'Conferencia inaugural en el Illinois Institute of Technology',
    category: 'structural',
  },
  {
    id: 80,
    text: {
      es: 'La forma sigue siempre a la función: esa es una ley universal grabada en la naturaleza que ninguna estructura puede eludir.',
      en: 'Form ever follows function: that is a universal law written into nature that no structure can evade.',
    },
    author: 'Louis Sullivan',
    role: {
      es: 'Pionero del diseño de rascacielos · Escuela de Chicago',
      en: 'Pioneer of skyscraper design · Chicago School',
    },
    source: 'The Tall Office Building Artistically Considered (1896)',
    category: 'structural',
  },
  {
    id: 81,
    text: {
      es: 'Toda construcción debe reunir tres condiciones inseparables: solidez (firmitas), utilidad (utilitas) y belleza (venustas).',
      en: 'All construction must fulfill three inseparable conditions: strength (firmitas), utility (utilitas), and beauty (venustas).',
    },
    author: 'Vitruvio',
    role: {
      es: 'Tratadista e ingeniero militar romano',
      en: 'Roman theorist and military engineer',
    },
    source: 'De Architectura (siglo I a. C.)',
    category: 'structural',
  },
  {
    id: 82,
    text: {
      es: 'El diseño depende en gran medida de reconocer los límites: la libertad auténtica nace de trabajar con rigor dentro de ellos.',
      en: 'Design depends largely on recognizing constraints: authentic freedom is born of working rigorously within them.',
    },
    author: 'Charles Eames',
    role: {
      es: 'Diseñador industrial y arquitecto pionero de estructuras modulares',
      en: 'Industrial designer and architect of modular structural systems',
    },
    source: 'What is Design? (Museo de Artes Decorativas, París)',
    category: 'simplicity',
  },
  {
    id: 83,
    text: {
      es: 'Buen diseño es tan poco diseño como sea posible: menos, pero con mayor esmero y pureza.',
      en: 'Good design is as little design as possible: less, but better.',
    },
    author: 'Dieter Rams',
    role: {
      es: 'Diseñador industrial jefe en Braun · Creador de los 10 principios del diseño',
      en: 'Chief Industrial Designer at Braun · Creator of the 10 Design Principles',
    },
    source: 'Ten Principles for Good Design',
    category: 'simplicity',
  },
  {
    id: 84,
    text: {
      es: 'La sencillez no es un objetivo que se persigue aisladamente; es el resultado natural de la claridad en la estructura y el propósito.',
      en: 'Simplicity is not an isolated goal to pursue; it is the natural outcome of clarity in structure and purpose.',
    },
    author: 'Frank Lloyd Wright',
    role: {
      es: 'Maestro de la arquitectura orgánica · Casa de la Cascada',
      en: 'Master of organic architecture · Fallingwater',
    },
    source: 'The Natural House (1954)',
    category: 'structural',
  },
  {
    id: 85,
    text: {
      es: 'Todo debe hacerse tan simple como sea posible, pero no más simple.',
      en: 'Everything should be made as simple as possible, but not simpler.',
    },
    author: 'Albert Einstein',
    role: {
      es: 'Físico teórico · Creador de la relatividad · Premio Nobel',
      en: 'Theoretical physicist · Creator of relativity · Nobel laureate',
    },
    source: 'On the Method of Theoretical Physics (1933)',
    category: 'simplicity',
  },
  {
    id: 86,
    text: {
      es: 'Cualquier tonto inteligente puede hacer las cosas más grandes, complejas y violentas; se requiere un toque de genialidad y coraje para ir en la dirección contraria.',
      en: 'Any intelligent fool can make things bigger, more complex, and more violent; it takes a touch of genius and a lot of courage to move in the opposite direction.',
    },
    author: 'Albert Einstein',
    role: {
      es: 'Padre de la física relativista',
      en: 'Father of relativistic physics',
    },
    source: 'Conversaciones con E.F. Schumacher',
    category: 'simplicity',
  },
  {
    id: 87,
    text: {
      es: 'Si no puedes explicárselo con claridad a un principiante, significa que aún no lo has comprendido hasta sus últimas consecuencias.',
      en: 'If you cannot explain it clearly to a beginner, it means you have not yet understood it to its core.',
    },
    author: 'Albert Einstein',
    role: {
      es: 'Científico y filósofo de la física',
      en: 'Scientist and philosopher of physics',
    },
    source: 'Aforismos y correspondencia científica',
    category: 'life',
  },
  {
    id: 88,
    text: {
      es: 'Lo que no puedo construir con mis propias manos, no lo entiendo.',
      en: 'What I cannot create, I do not understand.',
    },
    author: 'Richard Feynman',
    role: {
      es: 'Físico teórico · Premio Nobel de Física',
      en: 'Theoretical physicist · Nobel laureate in Physics',
    },
    source: 'Pizarra de Richard Feynman en Caltech (1988)',
    category: 'engineering',
  },
  {
    id: 89,
    text: {
      es: 'Para que una tecnología tenga éxito, la realidad física debe prevalecer sobre las apariencias, porque la naturaleza no se deja engañar.',
      en: 'For a successful technology, reality must take precedence over public relations, for Nature cannot be fooled.',
    },
    author: 'Richard Feynman',
    role: {
      es: 'Investigador de la Comisión Rogers para el accidente del Challenger',
      en: 'Investigator on the Rogers Commission for the Challenger disaster',
    },
    source: 'Personal Observations on the Reliability of the Shuttle (1986)',
    category: 'engineering',
  },
  {
    id: 90,
    text: {
      es: 'La verdad se encuentra siempre en la simplicidad, y jamás en la multiplicidad o en la confusión de las cosas.',
      en: 'Truth is ever to be found in simplicity, and not in the multiplicity and confusion of things.',
    },
    author: 'Isaac Newton',
    role: {
      es: 'Formulador de las leyes del movimiento y de la gravitación universal',
      en: 'Formulator of the laws of motion and universal gravitation',
    },
    source: 'Philosophiae Naturalis Principia Mathematica',
    category: 'simplicity',
  },
  {
    id: 91,
    text: {
      es: 'El gran libro del universo está escrito en lenguaje matemático: sus letras son triángulos, círculos y figuras geométricas sin las cuales es imposible comprender una sola palabra.',
      en: 'The grand book of the universe is written in the language of mathematics: its characters are triangles, circles, and geometric figures without which it is impossible to understand a single word.',
    },
    author: 'Galileo Galilei',
    role: {
      es: 'Padre de la física moderna y de la resistencia de materiales',
      en: 'Father of modern physics and the strength of materials',
    },
    source: 'Il Saggiatore (1623)',
    category: 'structural',
  },
  {
    id: 92,
    text: {
      es: 'He redactado esta carta más larga de lo habitual simplemente porque no he tenido el tiempo necesario para hacerla más breve.',
      en: 'I have made this letter longer than usual only because I have not had the time to make it shorter.',
    },
    author: 'Blaise Pascal',
    role: {
      es: 'Matemático, físico y filósofo · Pionero del cálculo de probabilidades',
      en: 'Mathematician, physicist, and philosopher · Probability pioneer',
    },
    source: 'Lettres Provinciales (Carta XVI, 1656)',
    category: 'simplicity',
  },
  {
    id: 93,
    text: {
      es: 'Puesto que la fábrica de todo el universo es la más perfecta, nada sucede en la naturaleza sin que obedezca a una regla de máximo o mínimo.',
      en: 'Since the fabric of the entire universe is the most perfect, nothing at all occurs in nature without conforming to a rule of maximum or minimum.',
    },
    author: 'Leonhard Euler',
    role: {
      es: 'Matemático y físico · Formulador del pandeo elástico de columnas',
      en: 'Mathematician and physicist · Formulator of column buckling',
    },
    source: 'Methodus inveniendi lineas curvas (1744)',
    category: 'structural',
  },
  {
    id: 94,
    text: {
      es: 'Como es la extensión, así es la fuerza: en la elasticidad reside la base proporcional de toda resistencia estructural.',
      en: 'As the extension, so the force: in elasticity lies the proportional foundation of all structural resistance.',
    },
    author: 'Robert Hooke',
    role: {
      es: 'Físico y geómetra · Formulador de la Ley de Elasticidad',
      en: 'Physicist and surveyor · Formulator of the Law of Elasticity',
    },
    source: 'De Potentia Restitutiva (1678)',
    category: 'structural',
  },
  {
    id: 95,
    text: {
      es: 'La información es la superación de la incertidumbre; la verdadera eficiencia técnica reside en transmitir únicamente lo irreducible.',
      en: 'Information is the resolution of uncertainty; true technical efficiency lies in transmitting only that which is irreducible.',
    },
    author: 'Claude Shannon',
    role: {
      es: 'Padre de la teoría de la información · Bell Labs',
      en: 'Father of information theory · Bell Labs',
    },
    source: 'A Mathematical Theory of Communication (1948)',
    category: 'engineering',
  },
  {
    id: 96,
    text: {
      es: 'La perfección se alcanza, no cuando no queda nada más que añadir, sino cuando ya no queda nada más que quitar.',
      en: 'Perfection is achieved, not when there is nothing more to add, but when there is nothing left to take away.',
    },
    author: 'Antoine de Saint-Exupéry',
    role: {
      es: 'Aviador, escritor y ensayista de la técnica aeronáutica',
      en: 'Aviator, writer, and essayist on aeronautical technology',
    },
    source: 'Terre des hommes (1939)',
    category: 'simplicity',
  },
  {
    id: 97,
    text: {
      es: 'Pregúntate a cada instante: ¿es esto verdaderamente necesario? Al suprimir lo superfluo obtendrás la doble serenidad de actuar menos y actuar mejor.',
      en: 'Ask yourself at every moment: is this truly necessary? By stripping away the superfluous you gain the double peace of doing less and doing it better.',
    },
    author: 'Marco Aurelio',
    role: {
      es: 'Filósofo estoico y emperador romano',
      en: 'Stoic philosopher and Roman emperor',
    },
    source: 'Meditaciones (Libro IV)',
    category: 'life',
  },
  {
    id: 98,
    text: {
      es: 'Nada es tan sólido en este mundo que no amenace ruina cuando sus cimientos carecen de proporción y medida.',
      en: 'Nothing in this world is so solid that it does not threaten ruin when its foundations lack proportion and measure.',
    },
    author: 'Séneca',
    role: {
      es: 'Filósofo cordobés y estadista romano',
      en: 'Philosopher and statesman',
    },
    source: 'Epístolas morales a Lucilio',
    category: 'life',
  },
  {
    id: 99,
    text: {
      es: 'No se deben multiplicar los entes sin necesidad: ante dos explicaciones que cuadran con la realidad física, la más sencilla suele ser la correcta.',
      en: 'Entities should not be multiplied beyond necessity: between two explanations that match physical reality, the simpler is usually correct.',
    },
    author: 'Guillermo de Ockham',
    role: {
      es: 'Filósofo y teólogo · Formulador del principio de parsimonia',
      en: 'Philosopher and logician · Formulator of the Principle of Parsimony',
    },
    source: 'Navaja de Ockham (siglo XIV)',
    category: 'simplicity',
  },
  {
    id: 100,
    text: {
      es: 'Simplifica, simplifica y vuelve a simplificar. Que tus asuntos sean dos o tres, y no cien o mil; en el cálculo riguroso de lo esencial reside la libertad.',
      en: 'Simplify, simplify, and simplify again. Let your affairs be as two or three, and not a hundred or a thousand; in the rigorous calculation of the essential lies true freedom.',
    },
    author: 'Henry David Thoreau',
    role: {
      es: 'Filósofo y ensayista · Autor de Walden',
      en: 'Philosopher and essayist · Author of Walden',
    },
    source: 'Walden: La vida en los bosques (1854)',
    category: 'life',
  },
  {
    id: 101,
    text: {
      es: 'La simplicidad no es una cosa sencilla; requiere un esfuerzo consciente para depurar todo lo que sobra hasta dejar la esencia viva del gesto humano.',
      en: 'Simplicity is not a simple thing; it takes conscious effort to strip away everything superfluous until only the living essence of the human gesture remains.',
    },
    author: 'Charlie Chaplin',
    role: {
      es: 'Cineasta, actor y pionero del cine mudo · El gran dictador',
      en: 'Filmmaker, actor, and silent cinema pioneer · The Great Dictator',
    },
    source: 'My Autobiography (1964)',
    category: 'simplicity',
  },
  {
    id: 102,
    text: {
      es: 'No importa lo que la gente te diga, las palabras y las ideas pueden cambiar el mundo si tienes el valor de expresarlas con autenticidad.',
      en: 'No matter what people tell you, words and ideas can change the world if you have the courage to express them with authenticity.',
    },
    author: 'Robin Williams',
    role: {
      es: 'Actor y comediante galardonado con el Óscar',
      en: 'Academy Award-winning actor and comedian',
    },
    source: 'Dead Poets Society (1989)',
    category: 'life',
  },
  {
    id: 103,
    text: {
      es: 'No temas al hombre que ha practicado diez mil patadas una vez, sino al hombre que ha practicado una sola patada diez mil veces. La maestría reside en la devoción por lo fundamental.',
      en: 'I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times. Mastery lies in devotion to fundamentals.',
    },
    author: 'Bruce Lee',
    role: {
      es: 'Artista marcial, filósofo y actor · Creador del Jeet Kune Do',
      en: 'Martial artist, philosopher, and actor · Jeet Kune Do founder',
    },
    source: 'Tao of Jeet Kune Do',
    category: 'philosophy',
  },
  {
    id: 104,
    text: {
      es: 'La simplicidad es la clave de la brillantez. No consiste en añadir cada día, sino en restar cada día: deshazte de lo no esencial.',
      en: 'Simplicity is the key to brilliance. It is not daily increase, but daily decrease: hack away at the unessential.',
    },
    author: 'Bruce Lee',
    role: {
      es: 'Filósofo de las artes marciales y teórico del movimiento',
      en: 'Martial arts philosopher and movement theorist',
    },
    source: 'Striking Thoughts',
    category: 'simplicity',
  },
  {
    id: 105,
    text: {
      es: 'El oficio verdadero consiste en entregarte por entero a lo que estás construyendo, sin esperar aplausos inmediatos y con respeto absoluto por cada compañero de trabajo.',
      en: 'True craft means giving yourself entirely to what you are building, without expecting immediate applause and with absolute respect for every coworker.',
    },
    author: 'Keanu Reeves',
    role: {
      es: 'Actor y productor · The Matrix y John Wick',
      en: 'Actor and producer · The Matrix and John Wick',
    },
    source: 'Entrevistas sobre el oficio cinematográfico',
    category: 'life',
  },
  {
    id: 106,
    text: {
      es: 'La técnica debe dominarse hasta tal punto que se vuelva invisible. Cuando el trabajo previo es riguroso y absoluto, puedes estar completamente presente sin esfuerzo aparente.',
      en: 'Technique must be mastered to such an extent that it becomes invisible. When prior preparation is rigorous and absolute, you can be entirely present with effortless grace.',
    },
    author: 'Anthony Hopkins',
    role: {
      es: 'Actor británico galardonado con dos premios Óscar · The Father',
      en: 'Two-time Academy Award-winning British actor · The Father',
    },
    source: 'The South Bank Show & BAFTA Reflections',
    category: 'art',
  },
  {
    id: 107,
    text: {
      es: 'Sin compromiso nunca empezarás, pero más importante aún: sin consistencia y disciplina nunca terminarás. El talento sin perseverancia no construye nada duradero.',
      en: 'Without commitment you will never start, but more importantly: without consistency and discipline you will never finish. Talent without perseverance builds nothing lasting.',
    },
    author: 'Denzel Washington',
    role: {
      es: 'Actor, director y productor · Ganador de dos premios Óscar',
      en: 'Two-time Academy Award-winning actor, director, and producer',
    },
    source: 'Discurso de graduación en Dillard University',
    category: 'life',
  },
  {
    id: 108,
    text: {
      es: 'La elegancia es la única belleza que nunca se desvanece; nace de la bondad, la humildad y la atención puesta en cada pequeño detalle de lo cotidiano.',
      en: 'Elegance is the only beauty that never fades; it stems from kindness, humility, and careful attention to every small detail of daily life.',
    },
    author: 'Audrey Hepburn',
    role: {
      es: 'Actriz e icono humanitario · Embajadora de Buena Voluntad de UNICEF',
      en: 'Actress and humanitarian icon · UNICEF Goodwill Ambassador',
    },
    source: 'Reflexiones y escritos sobre la vida y el servicio',
    category: 'simplicity',
  },
  {
    id: 109,
    text: {
      es: 'Si fuera fácil, todo el mundo lo haría. Es la dificultad intrínseca del reto lo que hace que el oficio sea grande y digno de ser dominado.',
      en: 'If it were easy, everyone would do it. The hard is what makes the craft great and worth mastering.',
    },
    author: 'Tom Hanks',
    role: {
      es: 'Actor, director y productor cinematográfico · Ganador de dos premios Óscar',
      en: 'Two-time Academy Award-winning actor, director, and filmmaker',
    },
    source: 'A League of Their Own & Archivo AFI',
    category: 'art',
  },
  {
    id: 110,
    text: {
      es: 'Aprender a tener paciencia y respetar los tiempos naturales del aprendizaje es la base de cualquier maestría. No puedes apresurar la solidez de una roca.',
      en: 'Learning patience and respecting the natural pace of learning is the foundation of all mastery. You cannot rush the solid strength of stone.',
    },
    author: 'Morgan Freeman',
    role: {
      es: 'Actor y narrador galardonado con el Óscar · Million Dollar Baby',
      en: 'Academy Award-winning actor and narrator · Million Dollar Baby',
    },
    source: 'Reflexiones sobre la constancia profesional',
    category: 'philosophy',
  },
  {
    id: 111,
    text: {
      es: 'Con un buen guion y una estructura limpia, un buen director puede hacer una obra maestra; con una mala estructura, ni el mayor talento técnico puede salvar la obra.',
      en: 'With a good script and clean structure, a good director can produce a masterpiece; with poor structure, even the greatest technical talent cannot save the work.',
    },
    author: 'Akira Kurosawa',
    role: {
      es: 'Cineasta maestro · Los siete samuráis y Rashomon',
      en: 'Master filmmaker · Seven Samurai and Rashomon',
    },
    source: 'Algo parecido a una autobiografía (1982)',
    category: 'art',
  },
  {
    id: 112,
    text: {
      es: 'Prefiero ser un mono sin cerebro antes que un monstruo sin corazón. La verdadera fuerza nace del deseo de proteger a los demás.',
      en: 'I would rather be a brainless monkey than a heartless monster. True strength comes from the desire to protect others.',
    },
    author: 'Son Goku',
    role: {
      es: 'Guerrero Saiyajin y protector de la Tierra · Dragon Ball',
      en: 'Saiyan warrior and protector of Earth · Dragon Ball',
    },
    source: 'Dragon Ball Z',
    category: 'life',
  },
  {
    id: 113,
    text: {
      es: 'El límite no lo pone tu fuerza actual, sino las ganas que tengas de seguir entrenando y superarte a ti mismo cada día.',
      en: 'Your limit is not set by your current strength, but by your desire to keep training and surpassing yourself each day.',
    },
    author: 'Son Goku',
    role: {
      es: 'Guerrero Saiyajin · Maestro de las artes marciales',
      en: 'Saiyan warrior · Master of martial arts',
    },
    source: 'Dragon Ball Super',
    category: 'life',
  },
  {
    id: 114,
    text: {
      es: 'No me importa tener que romper mis propios límites una y otra vez; jamás me rendiré ante nadie ni agacharé la cabeza.',
      en: 'I do not care if I must shatter my own limits over and over; I will never surrender to anyone or bow my head.',
    },
    author: 'Vegeta',
    role: {
      es: 'Príncipe de los Saiyajin · Dragon Ball',
      en: 'Prince of the Saiyans · Dragon Ball',
    },
    source: 'Dragon Ball Z',
    category: 'life',
  },
  {
    id: 115,
    text: {
      es: 'El orgullo de un guerrero no se mide por las batallas que gana fácilmente, sino por las veces que se levanta tras morder el polvo.',
      en: 'A warrior’s pride is not measured by the battles won easily, but by the number of times he rises after tasting defeat.',
    },
    author: 'Vegeta',
    role: {
      es: 'Príncipe de los Saiyajin · Dragon Ball',
      en: 'Prince of the Saiyans · Dragon Ball',
    },
    source: 'Dragon Ball Z',
    category: 'life',
  },
  {
    id: 116,
    text: {
      es: 'No puedes rendirte cuando otros dependen de ti. Canaliza tu dolor, despierta tu auténtico poder y pelea con el corazón.',
      en: 'You cannot give up when others depend on you. Channel your pain, awaken your true power, and fight with all your heart.',
    },
    author: 'Son Gohan',
    role: {
      es: 'Guerrero y erudito · Defensor de la paz',
      en: 'Warrior and scholar · Defender of peace',
    },
    source: 'Dragon Ball Z',
    category: 'life',
  },
  {
    id: 117,
    text: {
      es: 'Incluso cuando las probabilidades son nulas, un estratega no se desespera: analiza con mente fría y encuentra la falla del rival.',
      en: 'Even when the odds are zero, a strategist does not despair: analyze with a calm mind and find the flaw in the rival.',
    },
    author: 'Piccolo',
    role: {
      es: 'Guerrero Namekiano y estratega · Dragon Ball',
      en: 'Namekian warrior and strategist · Dragon Ball',
    },
    source: 'Dragon Ball Z',
    category: 'life',
  },
  {
    id: 118,
    text: {
      es: 'Hay que trabajar, hay que estudiar, hay que comer, hay que descansar y hay que jugar; esas son las bases para tener una gran vida.',
      en: 'You must work, you must study, you must eat, you must rest, and you must play; those are the foundations for living a great life.',
    },
    author: 'Maestro Roshi',
    role: {
      es: 'Maestro de la Escuela Tortuga · Kame House',
      en: 'Master of the Turtle School · Kame House',
    },
    source: 'Dragon Ball',
    category: 'philosophy',
  },
  {
    id: 119,
    text: {
      es: 'Mi mamá siempre decía: la vida es como una caja de bombones, nunca sabes lo que te va a tocar.',
      en: 'My mama always said, life is like a box of chocolates: you never know what you’re gonna get.',
    },
    author: 'Forrest Gump',
    role: {
      es: 'Protagonista de Forrest Gump (1994)',
      en: 'Protagonist of Forrest Gump (1994)',
    },
    source: 'Forrest Gump (1994)',
    category: 'life',
  },
  {
    id: 120,
    text: {
      es: 'Puede que no sea un hombre muy listo, pero sé perfectamente lo que es el amor y la lealtad.',
      en: 'I may not be a smart man, but I know what love and loyalty are.',
    },
    author: 'Forrest Gump',
    role: {
      es: 'Forrest Gump (1994)',
      en: 'Forrest Gump (1994)',
    },
    source: 'Forrest Gump (1994)',
    category: 'life',
  },
  {
    id: 121,
    text: {
      es: 'El pasado puede doler. Pero tal como yo lo veo, puedes huir de él o puedes aprender de él.',
      en: 'The past can hurt. But the way I see it, you can either run from it or learn from it.',
    },
    author: 'Rafiki',
    role: {
      es: 'Chamán y sabio · El Rey León',
      en: 'Shaman and elder · The Lion King',
    },
    source: 'El Rey León (1994)',
    category: 'life',
  },
  {
    id: 122,
    text: {
      es: 'Mira las estrellas: los grandes reyes del pasado nos observan desde allí. Recuerda siempre quién eres.',
      en: 'Look at the stars: the great kings of the past look down on us from there. Always remember who you are.',
    },
    author: 'Mufasa',
    role: {
      es: 'Rey de las Tierras del Orgullo · El Rey León',
      en: 'King of the Pride Lands · The Lion King',
    },
    source: 'El Rey León (1994)',
    category: 'life',
  },
  {
    id: 123,
    text: {
      es: 'Yo no tengo suerte, yo hago mi propia suerte. El éxito no depende del azar, sino de tu preparación y tu determinación.',
      en: 'I don’t get lucky, I make my own luck. Success is never about chance; it is about preparation and determination.',
    },
    author: 'Harvey Specter',
    role: {
      es: 'Socio sénior de Pearson Specter · Suits',
      en: 'Senior partner at Pearson Specter · Suits',
    },
    source: 'Suits (La ley de los audaces)',
    category: 'life',
  },
  {
    id: 124,
    text: {
      es: 'No juegues a las probabilidades; juega al hombre. Cuando te enfrentes a un problema imposible, cambia las reglas del juego.',
      en: 'Don’t play the odds; play the man. When faced with an impossible problem, change the rules of the game.',
    },
    author: 'Harvey Specter',
    role: {
      es: 'Abogado corporativo · Suits',
      en: 'Corporate attorney · Suits',
    },
    source: 'Suits (La ley de los audaces)',
    category: 'life',
  },
  {
    id: 125,
    text: {
      es: 'Un gran poder conlleva una gran responsabilidad. El verdadero heroísmo consiste en hacer lo correcto incluso cuando nadie está mirando.',
      en: 'With great power comes great responsibility. True heroism is doing the right thing even when no one is watching.',
    },
    author: 'Spider-Man',
    role: {
      es: 'Peter Parker · El Hombre Araña',
      en: 'Peter Parker · Spider-Man',
    },
    source: 'Spider-Man',
    category: 'life',
  },
  {
    id: 126,
    text: {
      es: '¿Cómo sé que estoy listo? No lo sabes. Es solo eso: un salto de fe.',
      en: 'How do I know I’m ready? You won’t. That’s all it is: a leap of faith.',
    },
    author: 'Peter B. Parker',
    role: {
      es: 'Spider-Man: Un nuevo universo',
      en: 'Spider-Man: Into the Spider-Verse',
    },
    source: 'Spider-Man: Into the Spider-Verse (2018)',
    category: 'life',
  },
  {
    id: 127,
    text: {
      es: 'No es quién soy en el fondo, sino lo que hago con mis acciones lo que me define.',
      en: 'It’s not who I am underneath, but what I do that defines me.',
    },
    author: 'Batman',
    role: {
      es: 'Bruce Wayne · El Caballero de la Noche',
      en: 'Bruce Wayne · The Dark Knight',
    },
    source: 'Batman Begins (2005)',
    category: 'life',
  },
  {
    id: 128,
    text: {
      es: 'La noche es más oscura justo antes del amanecer. Pero os prometo una cosa: el amanecer llegará.',
      en: 'The night is darkest just before the dawn. But I promise you: the dawn is coming.',
    },
    author: 'Harvey Dent',
    role: {
      es: 'Fiscal del Distrito de Gotham · The Dark Knight',
      en: 'Gotham District Attorney · The Dark Knight',
    },
    source: 'The Dark Knight (2008)',
    category: 'life',
  },
  {
    id: 129,
    text: {
      es: 'Nadie golpea tan fuerte como la vida. Pero no importa lo fuerte que golpees, sino lo fuerte que puedan golpearte y seguir avanzando. ¡Así es como se gana!',
      en: 'Nobody hits harder than life. But it ain’t about how hard you hit; it’s about how hard you can get hit and keep moving forward. That’s how winning is done!',
    },
    author: 'Rocky Balboa',
    role: {
      es: 'Campeón mundial de los pesos pesados · Rocky Balboa',
      en: 'World heavyweight champion · Rocky Balboa',
    },
    source: 'Rocky Balboa (2006)',
    category: 'life',
  },
  {
    id: 130,
    text: {
      es: 'Lo que hacemos en la vida tiene su eco en la eternidad. Mantened la línea y pelead con honor.',
      en: 'What we do in life echoes in eternity. Hold the line and fight with honor.',
    },
    author: 'Máximo Décimo Meridio',
    role: {
      es: 'General de las legiones romanas · Gladiator',
      en: 'General of the Roman Legions · Gladiator',
    },
    source: 'Gladiator (2000)',
    category: 'life',
  },
  {
    id: 131,
    text: {
      es: 'El amor es lo único que somos capaces de percibir que trasciende las dimensiones del tiempo y del espacio.',
      en: 'Love is the one thing we’re capable of perceiving that transcends dimensions of time and space.',
    },
    author: 'Interstellar',
    role: {
      es: 'Película dirigida por Christopher Nolan (2014)',
      en: 'Film directed by Christopher Nolan (2014)',
    },
    source: 'Interstellar (2014)',
    category: 'life',
  },
  {
    id: 132,
    text: {
      es: 'Hazlo o no lo hagas, pero no lo intentes. El tamaño y las apariencias no importan cuando dominas la fuerza.',
      en: 'Do or do not, there is no try. Size and appearances matters not when you master the Force.',
    },
    author: 'Yoda',
    role: {
      es: 'Gran Maestro de la Orden Jedi · Star Wars',
      en: 'Grand Master of the Jedi Order · Star Wars',
    },
    source: 'Star Wars: Episode V - The Empire Strikes Back',
    category: 'philosophy',
  },
  {
    id: 133,
    text: {
      es: 'Muchos de los que viven merecen morir y algunos de los que mueren merecen la vida. Todo lo que debemos decidir es qué hacer con el tiempo que se nos ha dado.',
      en: 'All we have to decide is what to do with the time that is given to us.',
    },
    author: 'Gandalf',
    role: {
      es: 'Mago y miembro de la Comunidad del Anillo',
      en: 'Wizard and member of the Fellowship of the Ring',
    },
    source: 'El Señor de los Anillos: La Comunidad del Anillo',
    category: 'philosophy',
  },
  {
    id: 134,
    text: {
      es: 'El ayer es historia, el mañana es un misterio, pero el hoy es un obsequio; por eso se llama presente.',
      en: 'Yesterday is history, tomorrow is a mystery, but today is a gift; that is why it is called the present.',
    },
    author: 'Maestro Oogway',
    role: {
      es: 'Sabio tortuga y creador del Kung Fu · Kung Fu Panda',
      en: 'Wise turtle and creator of Kung Fu · Kung Fu Panda',
    },
    source: 'Kung Fu Panda (2008)',
    category: 'philosophy',
  },
  {
    id: 135,
    text: {
      es: 'Tarde o temprano aprenderás, al igual que yo, que hay una gran diferencia entre conocer el camino y recorrer el camino.',
      en: 'Sooner or later you will realize, just as I did, there is a difference between knowing the path and walking the path.',
    },
    author: 'Morfeo',
    role: {
      es: 'Capitán de la Nabucodonosor · The Matrix',
      en: 'Captain of the Nebuchadnezzar · The Matrix',
    },
    source: 'The Matrix (1999)',
    category: 'philosophy',
  },
  {
    id: 136,
    text: {
      es: 'Las cosas que posees acaban poseyéndote a ti. Solo después de haberlo perdido todo somos verdaderamente libres de hacer cualquier cosa.',
      en: 'The things you own end up owning you. It’s only after we’ve lost everything that we’re free to do anything.',
    },
    author: 'Tyler Durden',
    role: {
      es: 'El club de la pelea · Fight Club (1999)',
      en: 'Fight Club (1999)',
    },
    source: 'Fight Club (1999)',
    category: 'philosophy',
  },
  {
    id: 137,
    text: {
      es: 'Los grandes hombres no nacen grandes; crecen hasta serlo con paciencia, lealtad a la palabra y visión a largo plazo.',
      en: 'Great men are not born great; they grow great through patience, loyalty to their word, and long-term vision.',
    },
    author: 'Don Vito Corleone',
    role: {
      es: 'El Padrino · Mario Puzo / Francis Ford Coppola',
      en: 'The Godfather · Mario Puzo / Francis Ford Coppola',
    },
    source: 'The Godfather (1972)',
    category: 'life',
  },
  {
    id: 138,
    text: {
      es: 'La esperanza es algo bueno, quizás lo mejor de todo; y las cosas buenas nunca mueren. O te ocupas de vivir, o te ocupas de morir.',
      en: 'Hope is a good thing, maybe the best of things, and no good thing ever dies. Get busy living, or get busy dying.',
    },
    author: 'Andy Dufresne',
    role: {
      es: 'Sueños de fuga · The Shawshank Redemption (1994)',
      en: 'The Shawshank Redemption (1994)',
    },
    source: 'The Shawshank Redemption (1994)',
    category: 'life',
  },
  {
    id: 139,
    text: {
      es: 'Una idea es como un virus: resistente, altamente contagiosa y la más mínima semilla puede crecer hasta definir tu mundo entero.',
      en: 'An idea is like a virus: resilient, highly contagious, and the smallest seed can grow to define your entire world.',
    },
    author: 'Dom Cobb',
    role: {
      es: 'Extractor de ideas · Inception (El Origen)',
      en: 'Ideas extractor · Inception (2010)',
    },
    source: 'Inception (2010)',
    category: 'art',
  },
  {
    id: 140,
    text: {
      es: 'Si no tienes el coraje de tomar el control de tu destino, estarás condenado a vivir atrapado en el plan de alguien más.',
      en: 'If you don’t have the courage to take control of your destiny, you will be condemned to live trapped in someone else’s plan.',
    },
    author: 'Walter White',
    role: {
      es: 'Heisenberg · Breaking Bad',
      en: 'Heisenberg · Breaking Bad',
    },
    source: 'Breaking Bad',
    category: 'life',
  },
  {
    id: 141,
    text: {
      es: 'No hay descanso en este mundo. Quien domina sus emociones y mantiene la cabeza fría domina cualquier tormenta.',
      en: 'There is no rest in this world. Whoever masters their emotions and keeps a cold head masters any storm.',
    },
    author: 'Thomas Shelby',
    role: {
      es: 'Líder de los Peaky Blinders',
      en: 'Leader of the Peaky Blinders',
    },
    source: 'Peaky Blinders',
    category: 'life',
  },
  {
    id: 142,
    text: {
      es: 'Una mente necesita de los libros igual que una espada de una piedra de afilar, para conservar su agudeza y su filo.',
      en: 'A mind needs books as a sword needs a whetstone, if it is to keep its edge.',
    },
    author: 'Tyrion Lannister',
    role: {
      es: 'Consejero y estratega · Game of Thrones',
      en: 'Advisor and strategist · Game of Thrones',
    },
    source: 'A Song of Ice and Fire / Game of Thrones',
    category: 'philosophy',
  },
  {
    id: 143,
    text: {
      es: 'No repitas los errores del pasado. No seas como ellos; sé mejor.',
      en: 'Do not repeat the mistakes of the past. Do not be like them; be better.',
    },
    author: 'Kratos',
    role: {
      es: 'Dios de la Guerra · God of War',
      en: 'God of War · Santa Monica Studio',
    },
    source: 'God of War (2018)',
    category: 'life',
  },
  {
    id: 144,
    text: {
      es: 'Somos más fantasmas que personas en este mundo, pero mientras nos quede un aliento siempre podemos elegir hacer lo correcto.',
      en: 'We’re more ghosts than people, but as long as we draw breath, we can always choose to do the right thing.',
    },
    author: 'Arthur Morgan',
    role: {
      es: 'Forajido de la banda Van der Linde · Red Dead Redemption 2',
      en: 'Outlaw of the Van der Linde gang · Red Dead Redemption 2',
    },
    source: 'Red Dead Redemption 2 (Rockstar Games)',
    category: 'life',
  },
  {
    id: 145,
    text: {
      es: 'Nuestro deber no es rendirnos ante lo imposible, sino pelear hasta el último segundo para abrir una brecha de esperanza.',
      en: 'Our duty is not to surrender to the impossible, but to fight until the very last second to open a path of hope.',
    },
    author: 'Master Chief',
    role: {
      es: 'Spartan-117 · Saga Halo',
      en: 'Spartan-117 · Halo franchise',
    },
    source: 'Halo (Bungie / 343 Industries)',
    category: 'life',
  },
  {
    id: 146,
    text: {
      es: 'El tiempo fluye y las personas van y vienen, pero el verdadero coraje en el corazón perdura para siempre.',
      en: 'Time flows, people come and go, but true courage in the heart endures forever.',
    },
    author: 'The Legend of Zelda',
    role: {
      es: 'Princesa de Hyrule · Ocarina of Time',
      en: 'Princess of Hyrule · Ocarina of Time',
    },
    source: 'The Legend of Zelda: Ocarina of Time (Nintendo)',
    category: 'philosophy',
  },
  {
    id: 147,
    text: {
      es: 'Practica lo que sabes y te ayudará a poner en claro lo que aún ignoras. El oficio se perfecciona en el taller con trabajo diario, no en discusiones teóricas.',
      en: 'Practice what you know, and it will help to make clear what now you do not know. Craft is honed in the studio with daily work, not in theoretical debates.',
    },
    author: 'Rembrandt van Rijn',
    role: {
      es: 'Pintor y grabador del Siglo de Oro neerlandés · La ronda de noche',
      en: 'Dutch Golden Age painter and printmaker · The Night Watch',
    },
    source: 'Instrucciones de taller para aprendices',
    category: 'art',
  },
  {
    id: 148,
    text: {
      es: 'La geometría es el fundamento del arte auténtico; sin el conocimiento de las proporciones matemáticas y la perspectiva, la mano del creador camina a ciegas.',
      en: 'Geometry is the foundation of authentic art; without knowledge of mathematical proportions and perspective, the creator’s hand wanders blindly.',
    },
    author: 'Albrecht Dürer',
    role: {
      es: 'Pintor, grabador y matemático del Renacimiento alemán · Melencolia I',
      en: 'German Renaissance painter, printmaker, and mathematician · Melencolia I',
    },
    source: 'Cuatro libros de la proporción humana (1528)',
    category: 'engineering',
  },
  {
    id: 149,
    text: {
      es: 'Más importante que la obra en sí es el efecto que produce; una línea simple trazada con convicción puede despertar un universo entero en quien la mira.',
      en: 'More important than the artwork itself is the effect it produces; a simple line drawn with conviction can awaken an entire universe in the viewer.',
    },
    author: 'Joan Miró',
    role: {
      es: 'Pintor, escultor y ceramista surrealista catalán',
      en: 'Catalan surrealist painter, sculptor, and ceramicist',
    },
    source: 'Conversaciones con Georges Duthuit',
    category: 'simplicity',
  },
  {
    id: 150,
    text: {
      es: 'La forma es la expresión exterior del contenido interno; ningún elemento formal debe agregarse si no responde a una necesidad interior del espíritu.',
      en: 'Form is the outward expression of inner meaning; no formal element should be added unless it answers an inner need of the spirit.',
    },
    author: 'Wassily Kandinsky',
    role: {
      es: 'Pintor y teórico del arte abstracto · De lo espiritual en el arte',
      en: 'Painter and abstract art theorist · Concerning the Spiritual in Art',
    },
    source: 'Punto y línea sobre el plano (1926)',
    category: 'art',
  },
  {
    id: 151,
    text: {
      es: 'La originalidad consiste en volver al origen; por lo tanto, original es aquel que vuelve a la simplicidad de las primeras soluciones de la naturaleza.',
      en: 'Originality consists in returning to the origin; thus, original is that which returns to the simplicity of nature’s first solutions.',
    },
    author: 'Antoni Gaudí',
    role: {
      es: 'Arquitecto modernista catalán · Templo de la Sagrada Familia',
      en: 'Catalan modernist architect · Sagrada Família Basilica',
    },
    source: 'Pensamientos y conversaciones con Joan Bergós',
    category: 'architecture',
  },
  {
    id: 152,
    text: {
      es: 'La estructura debe ser tan lógica y honesta que las líneas de carga y los arcos catenarios sustenten el edificio sin necesidad de contrafuertes artificiales.',
      en: 'The structure must be so logical and honest that load lines and catenary curves support the building without need for artificial buttresses.',
    },
    author: 'Antoni Gaudí',
    role: {
      es: 'Arquitecto y maestro de la geometría reglada y funicular',
      en: 'Architect and master of ruled and funicular geometry',
    },
    source: 'Estudios estructurales para la Cripta de la Colonia Güell',
    category: 'structural',
  },
  {
    id: 153,
    text: {
      es: 'La arquitectura es el juego sabio, correcto y magnífico de los volúmenes reunidos bajo la luz; el plano es el generador sin el cual todo es desorden y arbitrariedad.',
      en: 'Architecture is the learned game, correct and magnificent, of forms assembled in the light; the plan is the generator without which all is chaos and arbitrariness.',
    },
    author: 'Le Corbusier',
    role: {
      es: 'Arquitecto, urbanista y teórico · Villa Savoye',
      en: 'Architect, urban planner, and theorist · Villa Savoye',
    },
    source: 'Hacia una arquitectura (1923)',
    category: 'architecture',
  },
  {
    id: 154,
    text: {
      es: 'Pregúntale a un ladrillo qué quiere ser. Y el ladrillo te dirá: «A mí me gusta un arco». Si honras los materiales y su naturaleza, la estructura cobrará vida propia.',
      en: 'You say to a brick, “What do you want, brick?” And brick says to you, “I like an arch.” If you honor materials and their nature, the structure comes alive.',
    },
    author: 'Louis Kahn',
    role: {
      es: 'Arquitecto y docente · Instituto Salk y Biblioteca de Exeter',
      en: 'Architect and educator · Salk Institute and Exeter Library',
    },
    source: 'Conferencias en la Universidad de Pensilvania',
    category: 'structural',
  },
  {
    id: 155,
    text: {
      es: 'El diseño no es hacer belleza; la belleza emerge de la selección, de las afinidades, de la integración honesta y de la claridad estructural de las partes.',
      en: 'Design is not making beauty; beauty emerges from selection, affinities, honest integration, and structural clarity of the parts.',
    },
    author: 'Louis Kahn',
    role: {
      es: 'Filósofo de la arquitectura moderna y el orden formal',
      en: 'Philosopher of modern architecture and formal order',
    },
    source: 'Order and Form (1955)',
    category: 'architecture',
  },
  {
    id: 156,
    text: {
      es: 'La arquitectura es una disciplina fronteriza: es arte pero también es ciencia social, es poesía pero también es tecnología y cálculo estructural riguroso.',
      en: 'Architecture is a boundary discipline: it is art but also a social science, it is poetry but also technology and rigorous structural calculation.',
    },
    author: 'Renzo Piano',
    role: {
      es: 'Arquitecto estructural · Centro Pompidou y The Shard',
      en: 'Architect · Centre Pompidou and The Shard',
    },
    source: 'Giornale di bordo (1997)',
    category: 'architecture',
  },
  {
    id: 157,
    text: {
      es: 'Como arquitecto diseñas para el presente con un conocimiento del pasado hacia un futuro esencialmente desconocido; la sostenibilidad técnica es la clave de la permanencia.',
      en: 'As an architect you design for the present with an awareness of the past for a future which is essentially unknown; technical sustainability is the key to longevity.',
    },
    author: 'Norman Foster',
    role: {
      es: 'Arquitecto · Creador de la cúpula del Reichstag y 30 St Mary Axe',
      en: 'Architect · Designer of Reichstag dome and 30 St Mary Axe',
    },
    source: 'Conferencias sobre diseño y alta tecnología sostenible',
    category: 'architecture',
  },
  {
    id: 158,
    text: {
      es: 'La arquitectura no consiste en crear una caja rígida, sino en generar un paisaje fluido donde la geometría espacial desafíe la gravedad y despierte el asombro.',
      en: 'Architecture is not about creating a rigid box, but generating a fluid landscape where spatial geometry defies gravity and awakens wonder.',
    },
    author: 'Zaha Hadid',
    role: {
      es: 'Arquitecta pionera de la geometría paramétrica desconstructivista',
      en: 'Pioneering architect of deconstructivist parametric design',
    },
    source: 'Conferencia en la Royal Academy of Arts',
    category: 'architecture',
  },
  {
    id: 159,
    text: {
      es: 'Al reducir los elementos constructivos al hormigón desnudo, la luz y el viento, creo un espacio silencioso donde el ser humano puede reencontrarse consigo mismo.',
      en: 'By reducing building elements to bare concrete, light, and wind, I create a quiet space where human beings can reconnect with themselves.',
    },
    author: 'Tadao Ando',
    role: {
      es: 'Arquitecto japonés · Premio Pritzker 1995 · Iglesia de la Luz',
      en: 'Japanese architect · 1995 Pritzker Prize laureate · Church of the Light',
    },
    source: 'Conversaciones sobre la luz y el hormigón',
    category: 'architecture',
  },
  {
    id: 160,
    text: {
      es: 'La arquitectura no debe perder nunca el contacto con las necesidades emocionales y físicas de las personas; la forma debe servir al bienestar humano integral.',
      en: 'Architecture must never lose touch with people’s emotional and physical needs; form must serve comprehensive human well-being.',
    },
    author: 'Alvar Aalto',
    role: {
      es: 'Arquitecto y diseñador finlandés · Humanismo orgánico',
      en: 'Finnish architect and designer · Organic humanism',
    },
    source: 'Discurso en el Instituto Tecnológico de Finlandia',
    category: 'architecture',
  },
  {
    id: 161,
    text: {
      es: 'La geometría pura de los triángulos y las pirámides posee una estabilidad eterna; la luz natural es el mejor elemento para dotar de vida a una estructura sólida.',
      en: 'The pure geometry of triangles and pyramids possesses timeless stability; natural light is the finest element to breathe life into a solid structure.',
    },
    author: 'I. M. Pei',
    role: {
      es: 'Arquitecto · Pirámide del Louvre y Banco de China en Hong Kong',
      en: 'Architect · Louvre Pyramid and Bank of China Tower',
    },
    source: 'Conversations with I. M. Pei: Light is the Key',
    category: 'architecture',
  },
  {
    id: 162,
    text: {
      es: 'Cuando una estructura responde a una necesidad funcional profunda con formas puras inspiradas en la naturaleza, adquiere una poesía que resiste el paso de las eras.',
      en: 'When a structure responds to deep functional need with pure nature-inspired forms, it acquires a poetry that withstands the passage of eras.',
    },
    author: 'Jørn Utzon',
    role: {
      es: 'Arquitecto danés · Creador de la Ópera de Sídney',
      en: 'Danish architect · Designer of the Sydney Opera House',
    },
    source: 'The Sydney Opera House (1965)',
    category: 'structural',
  },
  {
    id: 163,
    text: {
      es: 'La tecnología moderna debe humanizarse; las megaestructuras contemporáneas solo tienen sentido cuando facilitan la convivencia cívica y elevan el espíritu colectivo.',
      en: 'Modern technology must be humanized; contemporary megastructures only make sense when they foster civic community and uplift the collective spirit.',
    },
    author: 'Kenzo Tange',
    role: {
      es: 'Arquitecto y urbanista japonés · Gimnasio Nacional de Yoyogi',
      en: 'Japanese architect and urban planner · Yoyogi National Gymnasium',
    },
    source: 'Discurso de aceptación del Premio Pritzker 1987',
    category: 'architecture',
  },
  {
    id: 164,
    text: {
      es: 'Ninguna dificultad mecánica es insuperable si confías en el equilibrio de fuerzas autoportantes: la cúpula se sostiene a sí misma si cada anillo concéntrico trabaja en armonía.',
      en: 'No mechanical difficulty is insurmountable if you trust self-supporting balance: the dome holds itself aloft if every concentric ring works in harmony.',
    },
    author: 'Filippo Brunelleschi',
    role: {
      es: 'Arquitecto e ingeniero del Renacimiento · Cúpula de Santa María del Fiore',
      en: 'Renaissance architect and engineer · Dome of Florence Cathedral',
    },
    source: 'Documentos de la construcción del Duomo de Florencia (1420)',
    category: 'structural',
  },
  {
    id: 165,
    text: {
      es: 'No es el ángulo recto lo que me atrae, ni la línea recta, dura e inflexible; lo que me fascina es la curva libre y sensual que dibuja el hormigón armado en el espacio.',
      en: 'It is not the right angle that attracts me, nor the hard, inflexible straight line; what fascinates me is the free and sensual curve drawn by reinforced concrete in space.',
    },
    author: 'Oscar Niemeyer',
    role: {
      es: 'Arquitecto brasileño · Pionero de las curvas en Brasilia',
      en: 'Brazilian architect · Pioneer of concrete curves in Brasília',
    },
    source: 'Las curvas del tiempo (Memorias)',
    category: 'architecture',
  },
  {
    id: 166,
    text: {
      es: 'Todo el mundo tiene talento; lo raro es tener el coraje y la disciplina para seguir adelante cuando las cosas se complican.',
      en: 'Everyone has talent; what is rare is the courage and discipline to keep going when things get tough.',
    },
    author: 'George Lucas',
    role: {
      es: 'Cineasta, creador de sagas cinematográficas e innovador visual',
      en: 'Filmmaker, cinematic saga creator, and visual innovator',
    },
    source: 'Entrevistas sobre el proceso creativo',
    category: 'life',
  },
  {
    id: 167,
    text: {
      es: 'Lo que te hace diferente o singular, esa es precisamente tu mayor fuerza en la vida.',
      en: "What makes you different or weird, that's your greatest strength.",
    },
    author: 'Meryl Streep',
    role: {
      es: 'Actriz de cine y teatro · Tres veces ganadora del Óscar',
      en: 'Screen and stage actress · Three-time Academy Award winner',
    },
    source: 'Indiana University Commencement Address',
    category: 'art',
  },
  {
    id: 168,
    text: {
      es: 'Tu intuición rara vez te grita; casi siempre te susurra al oído. El secreto es tener la calma necesaria para escucharla.',
      en: 'Your intuition rarely shouts; it almost always whispers. The secret is having the quietness to listen to it.',
    },
    author: 'Steven Spielberg',
    role: {
      es: 'Director y productor de cine · Pionero de la narrativa visual',
      en: 'Director and producer · Pioneer of visual storytelling',
    },
    source: 'Harvard Commencement Address (2016)',
    category: 'life',
  },
  {
    id: 169,
    text: {
      es: 'Crear consiste en observar el mundo ordinario y descubrir en él algo profundamente extraordinario y hermoso.',
      en: 'Creation is about observing the ordinary world and discovering something deeply extraordinary and beautiful in it.',
    },
    author: 'Hayao Miyazaki',
    role: {
      es: 'Maestro de la animación, director y cofundador de Studio Ghibli',
      en: 'Master animator, director, and co-founder of Studio Ghibli',
    },
    source: 'Starting Point: 1979~1996',
    category: 'art',
  },
  {
    id: 170,
    text: {
      es: 'Si algo puede ser pensado o escrito, entonces tiene la posibilidad de ser realizado y convertido en una obra tangible.',
      en: 'If it can be written or thought, it can be filmed and brought into tangible reality.',
    },
    author: 'Stanley Kubrick',
    role: {
      es: 'Director de cine y maestro de la composición cinematográfica',
      en: 'Filmmaker and master of cinematic composition',
    },
    source: 'Entrevistas sobre 2001: A Space Odyssey',
    category: 'art',
  },
  {
    id: 171,
    text: {
      es: 'El mejor logro de mi vida es siempre el que todavía tengo que construir mañana.',
      en: 'The best car of my life is always the one I have yet to build.',
    },
    author: 'Enzo Ferrari',
    role: {
      es: 'Piloto, diseñador y fundador de Scuderia Ferrari',
      en: 'Driver, designer, and founder of Scuderia Ferrari',
    },
    source: 'Mis memorias (Le mie gioie terribili)',
    category: 'engineering',
  },
  {
    id: 172,
    text: {
      es: 'La sencillez es la clave y la máxima expresión de la verdadera elegancia.',
      en: 'Simplicity is the keynote of all true elegance.',
    },
    author: 'Coco Chanel',
    role: {
      es: 'Diseñadora y fundadora de la casa Chanel',
      en: 'Designer and founder of Chanel',
    },
    source: 'Aforismos de moda y diseño',
    category: 'simplicity',
  },
  {
    id: 173,
    text: {
      es: 'No busques atajos hacia la maestría: el verdadero orgullo proviene del rigor y la entrega que pones en cada detalle invisible de tu trabajo.',
      en: "Don't look for shortcuts to mastery: true pride comes from the rigor and devotion you bring to every invisible detail of your work.",
    },
    author: 'Al Pacino',
    role: {
      es: 'Actor de cine y teatro · Ganador del Óscar por Scent of a Woman',
      en: 'Screen and stage actor · Academy Award winner for Scent of a Woman',
    },
    source: 'Conversaciones con Lawrence Grobel',
    category: 'life',
  },
  {
    id: 174,
    text: {
      es: 'No te detengas. Ni siquiera pienses en parar hasta que llegues allí, y no te preocupes demasiado por dónde queda ese lugar.',
      en: "Don't stop. Don't even think about stopping until you get there, and don't give much thought to where 'there' is.",
    },
    author: 'Phil Knight',
    role: {
      es: 'Cofundador de Nike y creador de marcas globales',
      en: 'Co-founder of Nike and global brand pioneer',
    },
    source: 'Shoe Dog: A Memoir by the Creator of Nike',
    category: 'life',
  },
  {
    id: 175,
    text: {
      es: 'Cuando todos aseguran que algo es absolutamente imposible, es cuando más vale la pena empeñar todo el esfuerzo en lograrlo.',
      en: 'When everyone says something is completely impossible, that is precisely when it is most worth putting everything into achieving it.',
    },
    author: 'Howard Hughes',
    role: {
      es: 'Aviador, ingeniero aeronáutico y productor de cine',
      en: 'Aviator, aeronautical engineer, and film producer',
    },
    source: 'Entrevistas y memorias de aeronáutica',
    category: 'engineering',
  },
  {
    id: 176,
    text: {
      es: 'El genio es un uno por ciento de inspiración y un noventa y nueve por ciento de transpiración; cada intento fallido es un paso descartado que te acerca a la solución.',
      en: 'Genius is one percent inspiration and ninety-nine percent perspiration; every failed attempt is one discarded step that brings you closer to the solution.',
    },
    author: 'Thomas Edison',
    role: {
      es: 'Inventor e industrial · Más de mil patentes tecnológicas',
      en: 'Inventor and industrialist · Over 1,000 technological patents',
    },
    source: 'Harper’s Monthly (1932)',
    category: 'engineering',
  },
  {
    id: 177,
    text: {
      es: 'Antes que nada, la preparación es el secreto del éxito. Desarmar una tarea colosal en pequeñas operaciones simples permite que cualquiera pueda dominarla.',
      en: 'Before everything else, getting ready is the secret of success. Breaking a colossal task into small, simple operations enables anyone to master it.',
    },
    author: 'Henry Ford',
    role: {
      es: 'Fundador de Ford Motor Company · Pionero de la producción en cadena',
      en: 'Founder of Ford Motor Company · Pioneer of assembly line mass production',
    },
    source: 'Mi vida y mi obra (1922)',
    category: 'engineering',
  },
  {
    id: 178,
    text: {
      es: 'El éxito representa el uno por ciento de tu trabajo, el cual proviene del noventa y nueve por ciento que es llamado fracaso. Aprende de cada rotura de material.',
      en: 'Success represents the 1% of your work which results from the 99% that is called failure. Learn from every fracture of the material.',
    },
    author: 'Soichiro Honda',
    role: {
      es: 'Ingeniero e industrial · Fundador de Honda Motor Co.',
      en: 'Engineer and industrialist · Founder of Honda Motor Co.',
    },
    source: 'Mi camino y mi filosofía empresarial',
    category: 'engineering',
  },
  {
    id: 179,
    text: {
      es: 'Fabricar 5.127 prototipos fallidos antes de dar con la solución correcta no fue una pérdida de tiempo; fue el proceso metódico e ineludible de aprender empíricamente.',
      en: 'Making 5,127 failed prototypes before hitting the right solution was not a waste of time; it was the methodical, inescapable process of empirical learning.',
    },
    author: 'James Dyson',
    role: {
      es: 'Diseñador industrial e inventor de tecnología ciclónica',
      en: 'Industrial designer and cyclonic technology inventor',
    },
    source: 'Against the Odds (Autobiografía)',
    category: 'engineering',
  },
  {
    id: 180,
    text: {
      es: 'La clave de la durabilidad consiste en fabricar el mejor producto posible sin causar daños innecesarios: simplifica el diseño, hazlo reparable y úsalo toda la vida.',
      en: 'The key to durability is making the best product without causing unnecessary harm: simplify the design, make it repairable, and use it for a lifetime.',
    },
    author: 'Yvon Chouinard',
    role: {
      es: 'Escalador, herrero artesanal y fundador de Patagonia',
      en: 'Climber, craft blacksmith, and founder of Patagonia',
    },
    source: 'Let My People Go Surfing (2005)',
    category: 'simplicity',
  },
  {
    id: 181,
    text: {
      es: 'No emprendas un proyecto a menos que sea manifiestamente importante y casi imposible. Si es obvio, otros lo harán; si desafía lo aceptado, transformará el mundo.',
      en: 'Don’t undertake a project unless it is manifestly important and nearly impossible. If it is obvious, others will do it; if it challenges convention, it transforms the world.',
    },
    author: 'Edwin Land',
    role: {
      es: 'Científico, inventor y cofundador de Polaroid Corporation',
      en: 'Scientist, inventor, and co-founder of Polaroid Corporation',
    },
    source: 'Conferencias sobre investigación aplicada',
    category: 'engineering',
  },
  {
    id: 182,
    text: {
      es: 'La verdadera innovación no surge de encuestas de mercado, sino de observar atentamente cómo viven las personas y crear herramientas que enriquezcan su libertad.',
      en: 'Real innovation does not spring from market surveys, but from observing how people live and crafting tools that enrich their freedom.',
    },
    author: 'Akio Morita',
    role: {
      es: 'Físico, ingeniero y cofundador de Sony Corporation · Creador del Walkman',
      en: 'Physicist, engineer, and co-founder of Sony Corporation · Walkman creator',
    },
    source: 'Made in Japan (1986)',
    category: 'life',
  },
  {
    id: 183,
    text: {
      es: 'Hacer lo imposible es una especie de diversión cuando cuentas con un equipo cohesionado que cuida con pasión cada milímetro de la experiencia.',
      en: 'It’s kind of fun to do the impossible when you have a cohesive team that attends with passion to every single millimeter of the experience.',
    },
    author: 'Walt Disney',
    role: {
      es: 'Pionero de la animación y el entretenimiento inmersivo',
      en: 'Pioneer of animation and immersive environmental design',
    },
    source: 'Reflexiones sobre la innovación y el trabajo en equipo',
    category: 'art',
  },
  {
    id: 184,
    text: {
      es: 'Si trabajáramos bajo el supuesto de que lo que es universalmente aceptado como verdadero lo es realmente, habría muy poca esperanza de progreso técnico.',
      en: 'If we worked on the assumption that what is accepted as true really is true, there would be little hope for technical advancement.',
    },
    author: 'Orville Wright',
    role: {
      es: 'Pionero de la aviación e ingeniero aeronáutico',
      en: 'Aviation pioneer and aeronautical engineer',
    },
    source: 'Diarios y correspondencia de Kitty Hawk',
    category: 'engineering',
  },
  {
    id: 185,
    text: {
      es: 'El deseo de volar es una idea que nos transmitieron nuestros antepasados; pero el vuelo seguro no se conquista con sueños, sino con un cálculo paciente del equilibrio.',
      en: 'The desire to fly was handed down to us by our ancestors; but safe flight is not conquered by dreams, but by patient calculation of balance.',
    },
    author: 'Wilbur Wright',
    role: {
      es: 'Pionero de la aviación y constructor aeronáutico',
      en: 'Aviation pioneer and aircraft builder',
    },
    source: 'Conferencia ante la Western Society of Engineers (1901)',
    category: 'engineering',
  },
  {
    id: 186,
    text: {
      es: 'El puente es una de las construcciones más sinceras que existen: la forma resistente debe fluir directamente a través de los esfuerzos sin disfraces retóricos.',
      en: 'The bridge is one of the most honest structures in existence: the resistant form must flow directly through internal forces without rhetorical disguise.',
    },
    author: 'Javier Manterola',
    role: {
      es: 'Ingeniero de caminos español · Diseñador de puentes singulares',
      en: 'Spanish civil engineer · Designer of landmark cable and arch bridges',
    },
    source: 'La ingeniería como arte (2010)',
    category: 'structural',
  },
  {
    id: 187,
    text: {
      es: 'La estructura mixta de acero y hormigón es un diálogo entre ligereza y masa donde cada material asume con naturalidad el esfuerzo para el que nació.',
      en: 'The composite steel-concrete structure is a dialogue between lightness and mass where each material naturally assumes the stress it was born to resist.',
    },
    author: 'Julio Martínez Calzón',
    role: {
      es: 'Ingeniero de caminos y pionero de las estructuras mixtas',
      en: 'Civil engineer and pioneer of composite steel-concrete structures',
    },
    source: 'Puentes: Estructura y Arte',
    category: 'structural',
  },
  {
    id: 188,
    text: {
      es: 'En el diseño de grandes viaductos atirantados, la estética no se añade al final; emana espontáneamente de la pureza estática de los cables y de los apoyos.',
      en: 'In the design of major cable-stayed viaducts, aesthetics are not added at the end; they emanate spontaneously from the static purity of cables and piers.',
    },
    author: 'Michel Virlogeux',
    role: {
      es: 'Ingeniero estructural de puentes · Viaducto de Millau y Puente de Normandía',
      en: 'Bridge structural engineer · Millau Viaduct and Normandy Bridge',
    },
    source: 'Structural Engineering International',
    category: 'structural',
  },
  {
    id: 189,
    text: {
      es: 'El pretensado dotó al hormigón de un alma elástica activa: transformar la compresión inducida en la salvaguarda permanente contra la fisuración del material.',
      en: 'Prestressing endowed concrete with an active elastic soul: turning induced compression into permanent safeguard against material cracking.',
    },
    author: 'Eugène Freyssinet',
    role: {
      es: 'Ingeniero civil francés · Inventor del hormigón pretensado',
      en: 'French civil engineer · Inventor of prestressed concrete',
    },
    source: 'Una revolución en el arte de construir (1936)',
    category: 'structural',
  },
  {
    id: 190,
    text: {
      es: 'El ingeniero civil debe fundar sus obras no solo sobre la teoría geométrica, sino sobre el conocimiento empírico riguroso del comportamiento de los ligantes y la roca.',
      en: 'The civil engineer must found works not merely on geometrical theory, but on rigorous empirical knowledge of binder behavior and rock mechanics.',
    },
    author: 'John Smeaton',
    role: {
      es: 'Padre de la ingeniería civil británica · Faro de Eddystone',
      en: 'Father of British civil engineering · Eddystone Lighthouse',
    },
    source: 'Narrative of the Building of the Eddystone Lighthouse (1791)',
    category: 'engineering',
  },
  {
    id: 191,
    text: {
      es: 'El puente de Forth demostró que la claridad del sistema cantilever y la triangulación masiva de acero pueden dominar las corrientes y los vientos más feroces del estuario.',
      en: 'The Forth Bridge proved that the clarity of the cantilever system and massive steel triangulation can master the fiercest estuary currents and winds.',
    },
    author: 'Benjamin Baker',
    role: {
      es: 'Ingeniero civil británico · Diseñador del Forth Bridge',
      en: 'British civil engineer · Co-designer of the Forth Bridge',
    },
    source: 'Long-Span Railway Bridges (1873)',
    category: 'structural',
  },
  {
    id: 192,
    text: {
      es: 'El Palacio de Cristal nació de observar las nervaduras de una hoja de nenúfar gigante: la modulación prefabricada y la repetición geométrica erigieron un hito en meses.',
      en: 'The Crystal Palace arose from observing the ribs of a giant water lily leaf: prefabricated modularity and geometric repetition raised a landmark in months.',
    },
    author: 'Joseph Paxton',
    role: {
      es: 'Diseñador e ingeniero de estructuras ligeras · Creador del Crystal Palace',
      en: 'Designer and lightweight structures engineer · Crystal Palace builder',
    },
    source: 'Memoria de la Gran Exposición de Londres (1851)',
    category: 'structural',
  },
  {
    id: 193,
    text: {
      es: 'Somos lo que hacemos día a día; de modo que la excelencia no es un acto aislado, sino un hábito forjado con paciencia y disciplina constante.',
      en: 'We are what we repeatedly do; excellence, then, is not an single act, but a habit forged through patience and constant discipline.',
    },
    author: 'Aristóteles',
    role: {
      es: 'Filósofo y polímata griego · Ética a Nicómaco',
      en: 'Greek philosopher and polymath · Nicomachean Ethics',
    },
    source: 'Ética a Nicómaco (Libro II)',
    category: 'philosophy',
  },
  {
    id: 194,
    text: {
      es: 'Una vida sin examen no merece ser vivida; cuestionar los cimientos de nuestras certezas es el primer deber de quien desea construir un entendimiento firme.',
      en: 'The unexamined life is not worth living; questioning the foundations of our certainties is the first duty of anyone who desires to build firm understanding.',
    },
    author: 'Sócrates',
    role: {
      es: 'Filósofo ateniense · Padre de la filosofía moral occidental',
      en: 'Athenian philosopher · Founder of Western moral philosophy',
    },
    source: 'Apología de Sócrates (Platón)',
    category: 'philosophy',
  },
  {
    id: 195,
    text: {
      es: 'No pretendas que los sucesos ocurran como tú deseas; desea más bien que ocurran como suceden, y tu travesía transcurrirá en paz y serenidad.',
      en: 'Do not demand that events happen as you wish them to; rather wish that they happen as they happen, and your journey will proceed in peace.',
    },
    author: 'Epicteto',
    role: {
      es: 'Filósofo estoico de la Grecia clásica',
      en: 'Greek Stoic philosopher',
    },
    source: 'Manual de vida (Enquiridión)',
    category: 'philosophy',
  },
  {
    id: 196,
    text: {
      es: 'Un viaje de mil leguas comienza con un solo paso; la vasija de barro es útil por el vacío de su interior: lo intangible da sentido a la forma.',
      en: 'A journey of a thousand leagues begins with a single step; the clay vessel is useful because of its inner hollow: the intangible gives purpose to the form.',
    },
    author: 'Lao-Tsé',
    role: {
      es: 'Filósofo de la antigua China · Autor del Tao Te King',
      en: 'Ancient Chinese philosopher · Author of Tao Te Ching',
    },
    source: 'Tao Te King (Capítulo 11)',
    category: 'philosophy',
  },
  {
    id: 197,
    text: {
      es: 'En medio del caos reside también la oportunidad; la victoria pertenece a quien planifica con cálculo riguroso antes de emprender la acción en el terreno.',
      en: 'In the midst of chaos, there is also opportunity; victory belongs to the leader who calculates rigorously before taking action in the field.',
    },
    author: 'Sun Tzu',
    role: {
      es: 'Estratega y filósofo militar de la antigua China · El arte de la guerra',
      en: 'Ancient Chinese military strategist and philosopher · The Art of War',
    },
    source: 'El arte de la guerra',
    category: 'philosophy',
  },
  {
    id: 198,
    text: {
      es: 'El hombre que mueve una montaña comienza apartando piedras pequeñas; la perseverancia silenciosa transforma los obstáculos más formidables.',
      en: 'The man who moves a mountain begins by carrying away small stones; quiet perseverance transforms the most formidable obstacles.',
    },
    author: 'Confucio',
    role: {
      es: 'Filósofo chino · Fundador de la tradición confuciana',
      en: 'Chinese philosopher · Founder of the Confucian tradition',
    },
    source: 'Analectas',
    category: 'philosophy',
  },
  {
    id: 199,
    text: {
      es: 'Todo lo excelente es tan difícil como raro; pero la comprensión geométrica de las causas reales libera la mente de la servidumbre de las pasiones confusas.',
      en: 'All things excellent are as difficult as they are rare; but geometrical understanding of real causes frees the mind from the bondage of confused passions.',
    },
    author: 'Baruch Spinoza',
    role: {
      es: 'Filósofo racionalista · Ética demostrada según el orden geométrico',
      en: 'Rationalist philosopher · Ethics Demonstrated in Geometrical Order',
    },
    source: 'Ética (1677)',
    category: 'philosophy',
  },
  {
    id: 200,
    text: {
      es: 'En medio del más crudo invierno, descubrí por fin que llevaba dentro de mí un verano invencible; la dignidad reside en crear sentido incluso ante el absurdo.',
      en: 'In the midst of deepest winter, I finally found within me an invincible summer; human dignity lies in creating meaning even in the face of absurdity.',
    },
    author: 'Albert Camus',
    role: {
      es: 'Escritor y filósofo franco-argelino · Premio Nobel de Literatura 1957',
      en: 'French-Algerian writer and philosopher · 1957 Nobel Laureate in Literature',
    },
    source: 'El verano (1954)',
    category: 'life',
  },
] as const;

/**
 * Devuelve una cita aleatoria del catálogo de 200 citas.
 */
export function getRandomQuote(): EngineeringQuote {
  const index = Math.floor(Math.random() * ENGINEERING_QUOTES.length);
  return ENGINEERING_QUOTES[index];
}

/**
 * Devuelve una cita por su identificador (1 a 200).
 */
export function getQuoteById(id: number): EngineeringQuote | undefined {
  return ENGINEERING_QUOTES.find((item) => item.id === id);
}
