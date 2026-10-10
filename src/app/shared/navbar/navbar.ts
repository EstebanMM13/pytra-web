import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  LucideChartColumn,
  LucideChevronDown,
  LucidePlay,
  LucideDynamicIcon,
  LucideGamepad2,
  LucideHouse,
  LucideIconInput,
  LucideLayers,
  LucideLogOut,
  LucidePlus,
  LucideSearch,
  LucideUser,
  LucideDownload,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { UserService } from '../../core/services/user.service';
import { GameSearch } from '../game-search/game-search';
import { PytraMark } from '../ui/pytra-mark';

interface NavTab {
  path: string;
  labelKey: string;
  icon: LucideIconInput;
}

const WEB_TABS: NavTab[] = [
  { path: '/dashboard', labelKey: 'nav.home', icon: LucideHouse },
  { path: '/games', labelKey: 'nav.games', icon: LucideGamepad2 },
  { path: '/sagas', labelKey: 'nav.sagas', icon: LucideLayers },
  { path: '/years', labelKey: 'nav.years', icon: LucideChartColumn },
  { path: '/steam', labelKey: 'nav.steam', icon: LucideDownload },
];

/**
 * App chrome for authenticated pages: top navbar on web (md+), and below md a
 * compact header (logo + avatar menu with Steam/Profile) plus a fixed bottom tab bar.
 * Also owns the global Ctrl/⌘+K game search.
 */
@Component({
  selector: 'app-navbar',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    RouterLinkActive,
    TranslatePipe,
    GameSearch,
    PytraMark,
    LucideDynamicIcon,
    LucidePlus,
    LucideChevronDown,
    LucideSearch,
    LucideUser,
    LucideLogOut,
    LucideDownload,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.html',
  host: {
    '(document:keydown)': 'onGlobalKeydown($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class Navbar {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly runFormLauncher = inject(RunFormLauncher);
  protected readonly displayName = inject(UserService).displayName;

  protected readonly webTabs = WEB_TABS;
  /** Mobile tab bar: two tabs on each side of the central "+" button. */
  protected readonly mobileTabsLeft = WEB_TABS.slice(0, 2);
  protected readonly mobileTabsRight = WEB_TABS.slice(2, 4);

  protected readonly initial = computed(() => (this.displayName() ?? '?').charAt(0).toUpperCase());
  protected readonly shortcutLabel = /Mac|iPhone|iPad/i.test(globalThis.navigator?.userAgent ?? '')
    ? '⌘K'
    : 'Ctrl K';

  protected readonly searchOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly addOpen = signal(false);
  protected readonly addItems: { kind: 'run' | 'game' | 'saga'; labelKey: string; icon: LucideIconInput }[] = [
    { kind: 'run', labelKey: 'nav.addRun', icon: LucidePlay },
    { kind: 'game', labelKey: 'nav.addGame', icon: LucideGamepad2 },
    { kind: 'saga', labelKey: 'nav.addSaga', icon: LucideLayers },
  ];

  protected onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchOpen.set(true);
    } else if (event.key === 'Escape') {
      this.menuOpen.set(false);
      this.addOpen.set(false);
    }
  }

  protected newRun(): void {
    this.runFormLauncher.openNewRun();
  }

  protected add(kind: 'run' | 'game' | 'saga'): void {
    this.addOpen.set(false);
    if (kind === 'run') {
      this.newRun();
    } else {
      const target = kind === 'game' ? '/games' : '/sagas';
      // Keep the current filters only when already on the target page.
      const samePage = this.router.url.split('?')[0] === target;
      void this.router.navigate([target], {
        queryParams: { create: 1 },
        queryParamsHandling: samePage ? 'merge' : '',
      });
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.addOpen() && !(event.target as HTMLElement).closest('[data-add-menu]')) {
      this.addOpen.set(false);
    }
  }

  protected logout(): void {
    this.menuOpen.set(false);
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
