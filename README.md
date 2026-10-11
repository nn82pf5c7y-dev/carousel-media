# carousel-media

Publiczne repozytorium renderera karuzel i gotowych plikow slajdow (adresy dla Metricool).

- `runs/<id>/carousel.json`: tresc karuzeli. Wypchniecie takiego pliku uruchamia workflow `render-carousels`.
- Workflow renderuje slajdy (Playwright + ffmpeg), uruchamia kontrole jakosci i dopiero po jej przejsciu zapisuje pliki do `media/<id>/` z znacznikiem `DONE`.
- Adres pliku: `https://raw.githubusercontent.com/nn82pf5c7y-dev/carousel-media/main/media/<id>/slide-NN.(png|mp4)`.

Zrodlo i plan pracy (kolejka tematow, dokumentacja) sa w prywatnym repo `carousel-factory`.
