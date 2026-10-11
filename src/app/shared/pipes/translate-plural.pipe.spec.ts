import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { TranslatePluralPipe } from './translate-plural.pipe';

@Component({
  imports: [TranslatePluralPipe],
  template: `<span class="games">{{ 'common.games' | translatePlural: count() }}</span>
    <span class="played">{{ 'sagas.playedOf' | translatePlural: count() : { played: 0, total: count() } }}</span>`,
})
class Host {
  readonly count = signal(0);
}

describe('TranslatePluralPipe', () => {
  function setup() {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideTranslateService()] });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', {
      common: { games: '{{count}} juegos', games_one: '{{count}} juego' },
      sagas: { playedOf: '{{played}} de {{total}} jugados', playedOf_one: '{{played}} de {{total}} jugado' },
    });
    translate.setTranslation('en', {
      common: { games: '{{count}} games', games_one: '{{count}} game' },
      sagas: { playedOf: '{{played}} of {{total}} played' },
    });
    translate.use('es');
    const fixture = TestBed.createComponent(Host);
    const el = fixture.nativeElement as HTMLElement;
    const render = (count: number) => {
      fixture.componentInstance.count.set(count);
      fixture.detectChanges();
      return {
        games: el.querySelector('.games')!.textContent!.trim(),
        played: el.querySelector('.played')!.textContent!.trim(),
      };
    };
    return { translate, render };
  }

  it('picks singular and plural forms in Spanish', () => {
    const { render } = setup();
    expect(render(0).games).toBe('0 juegos');
    expect(render(1).games).toBe('1 juego');
    expect(render(2).games).toBe('2 juegos');
  });

  it('merges extra params and follows language changes', () => {
    const { translate, render } = setup();
    expect(render(1).played).toBe('0 de 1 jugado');
    expect(render(2).played).toBe('0 de 2 jugados');

    translate.use('en');
    expect(render(0).games).toBe('0 games');
    expect(render(1).games).toBe('1 game');
    expect(render(1).played).toBe('0 of 1 played');
    expect(render(2).games).toBe('2 games');
  });
});
