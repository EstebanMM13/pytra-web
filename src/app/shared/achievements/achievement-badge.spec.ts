import { TestBed } from '@angular/core/testing';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { PREFERENCES_KEY, PreferencesService } from '../../core/services/preferences.service';
import { AchievementBadge } from './achievement-badge';
import { Achievement } from './achievements';

const MASTERPIECES: Achievement = {
  id: 'masterpieces',
  category: 'ratings',
  tier: 'silver',
  icon: 'heart',
  current: 2,
  target: 5,
  unlocked: false,
  progress: 0.4,
  rank: 100,
};

describe('AchievementBadge', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  function render() {
    TestBed.configureTestingModule({ providers: [provideTranslateService({ lang: 'es', fallbackLang: 'es' })] });
    TestBed.inject(TranslateService).setTranslation('es', {
      achievements: { items: { masterpieces: { desc: 'Puntúa {{target}} juegos con {{high}} o más (máx. {{max}}, mín. {{low}})' } } },
    });
    const fixture = TestBed.createComponent(AchievementBadge);
    fixture.componentRef.setInput('achievement', MASTERPIECES);
    fixture.detectChanges();
    return fixture;
  }

  it('words the rating thresholds on 0–10 by default', () => {
    expect(render().nativeElement.textContent).toContain('Puntúa 5 juegos con 9 o más (máx. 10, mín. 4)');
  });

  it('words the rating thresholds on the scale preference', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ratingScale: '5' }));
    const fixture = render();
    expect(fixture.nativeElement.textContent).toContain('Puntúa 5 juegos con 4,5 o más (máx. 5, mín. 2)');

    TestBed.inject(PreferencesService).setRatingScale('100');
    fixture.componentRef.setInput('achievement', { ...MASTERPIECES });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Puntúa 5 juegos con 90 o más (máx. 100, mín. 40)');
  });
});
