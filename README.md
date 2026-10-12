# Central de projetos da válvula de 10 mm (redesign estilo CORSAIR)

Site estático (HTML + Tailwind compilado + JS puro). Sem build obrigatório para publicar.

## Testar localmente
    python3 -m http.server 8000      # dentro desta pasta (não funciona por file://, o 3D carrega os STL via fetch)

## Publicar
Envie a pasta inteira para a Vercel (ou qualquer hospedagem estática). Não precisa de node_modules.

## Editar o estilo
    npm install
    npm run dev      # recompila css/tailwind.css ao salvar
    npm run build    # versão minificada

Arquivos: index.html · src/input.css (tokens e componentes) · tailwind.config.js · css/viewer.css (moldura do CAD)
js/app.js (simuladores e interface) · js/viewer.js (visualizador 3D) · js/vendor/three.min.js (Three.js r128 local) · stl/

Tipografia: Montserrat (títulos), Chakra Petch (navegação/botões), Inter (texto), JetBrains Mono (telemetria) via Google Fonts.
