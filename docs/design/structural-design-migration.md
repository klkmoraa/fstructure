# Migración de Diseño Estructural

Fecha de corte: 2026-09-14.

Este documento es el manifiesto de cierre del prototipo independiente de Diseño Estructural. El origen queda fijado al commit `d80b45c011631e41384e7ad2f77ffad460e8cd5b`; no se mezclan historiales Git. Sólo se migran evidencia útil y los dos conceptos aceptados. La aplicación React, su demo, su configuración y sus estilos no entran al producto único. Los PDF normativos 2017/2020 tampoco se redistribuyen: se sustituyen por metadatos y enlaces oficiales en `normative-sources.json`.

## Manifiesto verificable

El bloque siguiente es datos, no una segunda explicación editorial. `src/design/structuralDesignMigration.test.ts` fija el árbol esperado, valida cada SHA-256, exige estado y razón, comprueba los PNG y rechaza cualquier PDF versionado.

```json migration-manifest
{
  "schemaVersion": 1,
  "sourceRepository": "https://github.com/klkmoraa/fsteucture-diseno-estructural.git",
  "sourceCommit": "d80b45c011631e41384e7ad2f77ffad460e8cd5b",
  "hashAlgorithm": "sha256",
  "artifacts": [
    {
      "sourcePath": ".gitignore",
      "sourceSha256": "dd28f1e7b17437741337da169e87889f77ae2fe81d41996ac81f4d0d624d9a33",
      "status": "replaced",
      "reason": "El repositorio único conserva sus propias reglas de exclusión.",
      "destinationPaths": [".gitignore"]
    },
    {
      "sourcePath": "README.md",
      "sourceSha256": "1666b49e90519f5412ee9fa4f066949fd1f3b75ff10ec9a008346d6b00fafa56",
      "status": "replaced",
      "reason": "La presentación del prototipo queda sustituida por la documentación del producto único.",
      "destinationPaths": ["README.md", "docs/design/structural-design-migration.md"]
    },
    {
      "sourcePath": "docs/qa/fidelity-ledger.md",
      "sourceSha256": "f753e271911e2368e56586ef062827ed8d1803cddb2769e12a8f65c72375c653",
      "status": "excluded",
      "reason": "El ledger medía una aplicación descartada; la integración tendrá QA nuevo en la Tarea 6."
    },
    {
      "sourcePath": "docs/references/normative/README.md",
      "sourceSha256": "11cb1c56a1f6ef7ef97ee8e0ad65758ab4f91d9e1114c24c3cb0714f48706ca7",
      "status": "replaced",
      "reason": "Las copias locales antiguas se sustituyen por un registro 2023 enlazado a fuentes oficiales.",
      "destinationPaths": ["docs/design/normative-sources.json"]
    },
    {
      "sourcePath": "docs/references/normative/ntc-acero-cdmx-2020.pdf",
      "sourceSha256": "5e36049f65ee38b7811898a5901c1b9b7c3b780dc8085454a9b8e1c79a1495f9",
      "status": "excluded",
      "reason": "PDF normativo antiguo; se conserva únicamente su huella histórica en este manifiesto."
    },
    {
      "sourcePath": "docs/references/normative/ntc-concreto-cdmx-2017.pdf",
      "sourceSha256": "cccf4adc874d09d260f1b1a31b1e31a7e1dec02ec745427ad738c33c8a112731",
      "status": "excluded",
      "reason": "PDF normativo antiguo; la edición de concreto objetivo es 2023 y se mantiene como enlace."
    },
    {
      "sourcePath": "docs/references/normative/ntc-sismo-cdmx-2020.pdf",
      "sourceSha256": "d6df0ca3ca4c9f9facafd6dc13b7fe99f677c3bf0a81041d27d163b8b7517df7",
      "status": "excluded",
      "reason": "PDF normativo antiguo y fuera del alcance inicial de viga; no se redistribuye."
    },
    {
      "sourcePath": "docs/references/normative/ntc-viento-cdmx-2017.pdf",
      "sourceSha256": "3fc936943df3bcf2d56ae148990a46887e1a6976307c5ca87dcb7c9a019674f0",
      "status": "excluded",
      "reason": "PDF normativo antiguo y fuera del alcance inicial de viga; no se redistribuye."
    },
    {
      "sourcePath": "docs/research/technical-landscape.md",
      "sourceSha256": "fffe40c368d5ed0f1e6234a319d7d2eb3923c0f412ce71ff83170f0939a8a204",
      "status": "migrated",
      "reason": "La investigación útil se revalidó contra fuentes primarias y se acotó a las herramientas requeridas.",
      "destinationPaths": ["docs/design/open-source-landscape.md"]
    },
    {
      "sourcePath": "docs/superpowers/plans/2026-09-13-fstructure-design-workbench.md",
      "sourceSha256": "d450f86fb4ad4d8299021f078cb47d562ceebbe52938b48dbc321a6d1155ddc0",
      "status": "replaced",
      "reason": "El plan del producto independiente fue sustituido por el plan de integración en Solver2D.",
      "destinationPaths": ["docs/superpowers/plans/2026-09-14-integrar-diseno-estructural.md"]
    },
    {
      "sourcePath": "docs/superpowers/specs/2026-09-13-fstructure-design-workbench-design.md",
      "sourceSha256": "9ab9897dd2015d7f8b86317755e7e520a183d73534bc6acea9c277fdfc77e955",
      "status": "replaced",
      "reason": "Sus decisiones aceptadas sobreviven en el plan integrado y en los conceptos, no como especificación paralela.",
      "destinationPaths": ["docs/superpowers/plans/2026-09-14-integrar-diseno-estructural.md", "public/concepts/design-workbench-desktop.png", "public/concepts/design-workbench-mobile.png"]
    },
    {
      "sourcePath": "index.html",
      "sourceSha256": "6957d9bf9cd174188797677e54d0ab019e056171c30a251152478e42f5d7410d",
      "status": "excluded",
      "reason": "Bootstrap de la aplicación React independiente; no se copia."
    },
    {
      "sourcePath": "package.json",
      "sourceSha256": "a0855ec32f81a9f9f5f84b07b5cb89a6f209f715dbe07a898e6cad2443b7c236",
      "status": "excluded",
      "reason": "Metadatos y dependencias del prototipo; el producto único conserva su stack."
    },
    {
      "sourcePath": "pnpm-lock.yaml",
      "sourceSha256": "0ec35ca5320ae918488d6fbbea4a87f517f62332a74aa8fc4fb2ea05cfa960af",
      "status": "excluded",
      "reason": "Lockfile del prototipo; no se mezclan grafos de dependencias."
    },
    {
      "sourcePath": "public/brand/fusionstructure-mark.svg",
      "sourceSha256": "9f5588f63173d7edfdf46cc69f5efcb6970045810c2786e72992124f60e33df4",
      "status": "replaced",
      "reason": "La marca canónica ya se genera desde el design system del repositorio único.",
      "destinationPaths": ["src/design-system/brand.tsx"]
    },
    {
      "sourcePath": "public/concepts/design-workbench-desktop.png",
      "sourceSha256": "a3c71f540233dac28a6557882d9b0c758ca93b8339d785fe54ffe5954e9e02fe",
      "status": "migrated",
      "reason": "Concepto de escritorio aprobado como referencia visual de la integración.",
      "destinationPaths": ["public/concepts/design-workbench-desktop.png"]
    },
    {
      "sourcePath": "public/concepts/design-workbench-mobile.png",
      "sourceSha256": "1e28864d43cdd25f4854b221f66d15e5ee644902c23cef3415179e98b1f5c464",
      "status": "migrated",
      "reason": "Concepto móvil aprobado como referencia visual de la integración.",
      "destinationPaths": ["public/concepts/design-workbench-mobile.png"]
    },
    {
      "sourcePath": "src/App.test.tsx",
      "sourceSha256": "f9b2e1d688772adc0705d75b9883ba818a34d212f29b3d86ba2e8b676eb5146b",
      "status": "excluded",
      "reason": "Prueba de la aplicación React independiente; no describe el producto integrado."
    },
    {
      "sourcePath": "src/App.tsx",
      "sourceSha256": "e3f4df7628c35477afd7f8af64504f2cafb01d369e332748f3023eacf2bee145",
      "status": "excluded",
      "reason": "Raíz de la aplicación React independiente; el brief prohíbe copiarla."
    },
    {
      "sourcePath": "src/appState.test.ts",
      "sourceSha256": "8e6bd3e93349fa8a507ac335d6904a46d4abd86694cf82eddd948a00de04440d",
      "status": "excluded",
      "reason": "Prueba de estado simulado del prototipo; la persistencia se implementará nativamente."
    },
    {
      "sourcePath": "src/appState.ts",
      "sourceSha256": "af81ceb9bf4bb17c4b912fed7d45c3225cd3f7c134bf5757a448521bd4a8d4ff",
      "status": "excluded",
      "reason": "Estado local del prototipo; no se acopla al contexto real de proyecto."
    },
    {
      "sourcePath": "src/components/AppShell.tsx",
      "sourceSha256": "e500d7fa0329a43c2ca8ade8d5266f854f96441a9bc4b708b804870b9a781d84",
      "status": "excluded",
      "reason": "Shell paralelo; Solver2D ya posee broker y composición adaptativa."
    },
    {
      "sourcePath": "src/components/DesignInspector.tsx",
      "sourceSha256": "0bebff4d1c18b9d7b66579ea95bb9e5201cdde10666a571d2978fe589963d3e9",
      "status": "excluded",
      "reason": "Inspector de demo sin datos reales; la superficie se implementará con componentes existentes."
    },
    {
      "sourcePath": "src/components/DetailSheet.tsx",
      "sourceSha256": "dbb0cfa152c04a9d7bb51113d8a16e6ec255b08f601442b3852e5d06f2e66b82",
      "status": "excluded",
      "reason": "Hoja visual de demo; el broker existente decide dock, drawer o pantalla completa."
    },
    {
      "sourcePath": "src/components/EvidencePanel.tsx",
      "sourceSha256": "71f81b98da87d191f294e69f154902bf2d87ed6ec46a020dd0e284406dd67aa7",
      "status": "excluded",
      "reason": "Panel con evidencia simulada; se reconstruirá desde resultados y procedencia verificables."
    },
    {
      "sourcePath": "src/components/ModelCanvas.tsx",
      "sourceSha256": "09f0dd69df6a43d69cc3a5f51d9d2f37917b2433e5cad29b6c114f8632ad1240",
      "status": "excluded",
      "reason": "Lienzo ilustrativo; no sustituye el canvas estructural real de Solver2D."
    },
    {
      "sourcePath": "src/components/ProjectRail.tsx",
      "sourceSha256": "506880903ebef7fff9053adb9a18f39ffe9f9f204d32fa5d50e3376f7daefa37",
      "status": "excluded",
      "reason": "Navegación paralela del prototipo; no se duplica el shell del producto."
    },
    {
      "sourcePath": "src/components/ResultStack.tsx",
      "sourceSha256": "2678c729b1627c1a01e8e2e3638259c3bf2acaf65a9aa5b1d3717e63c3fdb1d8",
      "status": "excluded",
      "reason": "Resultados simulados; la integración debe consumir resultados exactos del solver."
    },
    {
      "sourcePath": "src/components/StatusBadge.tsx",
      "sourceSha256": "d6670a2eb5fb5c1d03b86bbb28dace06c7f7f8509cfc383ce93ee1a940613ab4",
      "status": "excluded",
      "reason": "Componente duplicado; los estados usarán controles del design system existente."
    },
    {
      "sourcePath": "src/components/Topbar.tsx",
      "sourceSha256": "f0b5daea6e0c281f4cd9888ae77a8c8782eed89f723937517d1807a458ab0381",
      "status": "excluded",
      "reason": "Topbar paralelo; la acción Diseño se añadirá al WorkspaceTopBar vigente."
    },
    {
      "sourcePath": "src/components/icons.tsx",
      "sourceSha256": "f683426daad9a318365b72051dbff2c455e12629d68c2ea9c1e34c5514215e3b",
      "status": "excluded",
      "reason": "Iconos ad hoc del prototipo; se reutiliza Lucide y la iconografía estructural canónica."
    },
    {
      "sourcePath": "src/data/brandTokens.ts",
      "sourceSha256": "9acc3a651508e62d74203c3769c9d1d6c48b5ecf050ffdc95300822de31d5cd7",
      "status": "replaced",
      "reason": "El snapshot parcial se sustituye por el handoff del brandbook y los tokens ya vigentes.",
      "destinationPaths": ["docs/design/brandbook-handoff.md", "src/design-system/tokens.css"]
    },
    {
      "sourcePath": "src/data/references.ts",
      "sourceSha256": "b6e15407023c9d2ff3d203a1636c5a65df2f9aef68ee81723fd867c2c9e9e8b1",
      "status": "replaced",
      "reason": "Referencias embebidas de demo se sustituyen por un registro normativo auditable.",
      "destinationPaths": ["docs/design/normative-sources.json"]
    },
    {
      "sourcePath": "src/domain/demoDesign.ts",
      "sourceSha256": "cd1d373bb4044867f36ec2efd87239ecef931076bdf61677857c36a17b1cee4f",
      "status": "excluded",
      "reason": "Datos ficticios; la integración no presentará resultados simulados."
    },
    {
      "sourcePath": "src/domain/design.ts",
      "sourceSha256": "88c4abc2761633771e39f5622c7d0ea26af6ae722af9f4afb80f530b56a24b09",
      "status": "excluded",
      "reason": "Dominio de prototipo no trazable; el contrato real se implementará por TDD en tareas posteriores."
    },
    {
      "sourcePath": "src/domain/designTransforms.test.ts",
      "sourceSha256": "68c61b62e810ffb615cc1749ae20f66b085b2fe82c413f774274aeb80b6cf42c",
      "status": "excluded",
      "reason": "Prueba ligada al dominio descartado; no protege comportamiento del producto único."
    },
    {
      "sourcePath": "src/domain/designTransforms.ts",
      "sourceSha256": "7ca5bffce3ed4c9788742f27a8fd5deaa2fe2bef63267aaa71ed82cf24be1031",
      "status": "excluded",
      "reason": "Transformaciones sobre datos de demo; se reemplazarán por cálculo derivado verificable."
    },
    {
      "sourcePath": "src/main.tsx",
      "sourceSha256": "f11b5c2fb8b63400f9ddecc0948af6b9292b128c90c0e8a7c51463f2b6bec8b0",
      "status": "excluded",
      "reason": "Punto de entrada de la app independiente; no se copia."
    },
    {
      "sourcePath": "src/styles/global.css",
      "sourceSha256": "69e702aa939eb46cce2fabc6ffb3eb848fddec47dd2b06d9deae1dedabd31eed",
      "status": "excluded",
      "reason": "Reset y layout globales del prototipo entrarían en conflicto con Solver2D."
    },
    {
      "sourcePath": "src/styles/tokens.css",
      "sourceSha256": "a1a0f2c043130eac2e20455c614a1db744bfa2afc8840abb46a0b620b65446f2",
      "status": "replaced",
      "reason": "Los tokens parciales quedan reemplazados por la única fuente del design system existente.",
      "destinationPaths": ["src/design-system/tokens.css", "docs/design/brandbook-handoff.md"]
    },
    {
      "sourcePath": "src/styles/workbench.css",
      "sourceSha256": "41d887398d7f5d55f973da60312928314017744ad220e85df5f2d3a88e6cc730",
      "status": "excluded",
      "reason": "CSS de una maqueta independiente; la futura superficie usa patrones y tokens vigentes."
    },
    {
      "sourcePath": "src/test/setup.ts",
      "sourceSha256": "91a3c8962a0edcb956206a501d943fe99e1c78c6d4d8b5c9a948a3362c75978c",
      "status": "excluded",
      "reason": "Harness del prototipo; Solver2D ya dispone de infraestructura de pruebas."
    },
    {
      "sourcePath": "src/vite-env.d.ts",
      "sourceSha256": "65996936fbb042915f7b74a200fcdde7e410f32a669b1ab9597cfaa4b0faddb5",
      "status": "excluded",
      "reason": "Declaración generada del proyecto Vite independiente."
    },
    {
      "sourcePath": "tsconfig.app.json",
      "sourceSha256": "18eef6f87ef638fb29585831d4c1898a1d06b725164f01d36be48120f6afa6d7",
      "status": "excluded",
      "reason": "Configuración TypeScript del prototipo; no se mezcla con la del producto."
    },
    {
      "sourcePath": "tsconfig.json",
      "sourceSha256": "770b4140bbb581e2dfd9ea9946ffc9c75a1d86ba7d2db5f77c83e37cbdf9d808",
      "status": "excluded",
      "reason": "Configuración raíz del prototipo; Solver2D conserva su compilación."
    },
    {
      "sourcePath": "tsconfig.node.json",
      "sourceSha256": "2fba2f25e1859f193b54edef5d2d2cd08cae2a37fab64c08699f6f8672bea2cc",
      "status": "excluded",
      "reason": "Configuración de tooling del prototipo; no se necesita en la migración."
    },
    {
      "sourcePath": "vite.config.ts",
      "sourceSha256": "509442b5590ab975be841f4c099fa369abb0cc947c69afa4bc65e24cf487de62",
      "status": "excluded",
      "reason": "Configuración del bundle independiente; la app React no se migra."
    }
  ],
  "acceptedConcepts": [
    {
      "path": "public/concepts/design-workbench-desktop.png",
      "width": 1586,
      "height": 992,
      "sha256": "a3c71f540233dac28a6557882d9b0c758ca93b8339d785fe54ffe5954e9e02fe"
    },
    {
      "path": "public/concepts/design-workbench-mobile.png",
      "width": 853,
      "height": 1844,
      "sha256": "1e28864d43cdd25f4854b221f66d15e5ee644902c23cef3415179e98b1f5c464"
    }
  ]
}
```

## Decisiones de migración

- `migrated` significa que el valor del artefacto continúa en el repositorio único y se declara su destino.
- `replaced` significa que la necesidad sigue cubierta por una fuente canónica del producto único, no que los bytes se hayan copiado.
- `excluded` significa que el artefacto no entra; la razón evita que vuelva por accidente en una migración posterior.
- Los hashes corresponden a los bytes de cada archivo tal como están versionados en `d80b45c`. Los dos PNG conservan exactamente esos bytes.
- Este manifiesto no autoriza a usar resultados del prototipo como evidencia de ingeniería. El producto permanece experimental.
