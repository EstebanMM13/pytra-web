import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { LucideDynamicIcon, LucideIconInput } from '@lucide/angular';
import { ICONS } from '../ui/icons';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { RunFormLauncher } from '../../core/services/run-form-launcher.service';
import { UserService } from '../../core/services/user.service';
import { GlobalSearch } from '../global-search/global-search';
import { Avatar } from '../ui/avatar';
import { PytraMark } from '../ui/pytra-mark';
import { PytraWordmark } from '../ui/pytra-wordmark';
import { todayIso } from '../utils/run-dates';

type AddKind = 'diary' | 'run' | 'game' | 'saga';

interface NavTab {
  path: string;
  labelKey: string;
  icon: LucideIconInput;
  /** Web tab shown from lg only (at md the row has no room); the search palette still reaches it. */
  fromLg?: boolean;
  /** Other top-level paths the tab stays active on (the sections it groups). */
  also?: readonly string[];
}

const WEB_TABS: NavTab[] = [
  { path: '/dashboard', labelKey: 'nav.home', icon: ICONS.house },
  { path: '/games', labelKey: 'nav.games', icon: ICONS.gamepad2 },
  // Years and sagas are sections of the stats hub: the tab stays lit on them.
  { path: '/stats', labelKey: 'nav.stats', icon: ICONS.chartColumn, also: ['/years', '/sagas'] },
  { path: '/diary', labelKey: 'nav.diary', icon: ICONS.calendarDays },
  { path: '/sync', labelKey: 'nav.sync', icon: ICONS.refreshCw, fromLg: true },
];

/** Whether `url` is the tab's page, one below it, or one of the sections it groups. */
export function isTabActive(tab: Pick<NavTab, 'path' | 'also'>, url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return [tab.path, ...(tab.also ?? [])].some((base) => path === base || path.startsWith(base + '/'));
}

/**
 * App chrome for authenticated pages: top navbar on web (md+), and below md a
 * compact header (logo, search button and avatar menu: Profile, Sync, Log out) plus a fixed bottom
 * tab bar. Also owns the global Ctrl/⌘+K search.
 */
@Component({
  selector: 'app-navbar',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    GlobalSearch,
    PytraMark,
    PytraWordmark,
    Avatar,
    LucideDynamicIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navbar.html',
  host: {
    '(document:keydown)': 'onGlobalKeydown($event)',
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class Navbar {
  protected readonly icons = ICONS;

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly runFormLauncher = inject(RunFormLauncher);
  private readonly userService = inject(UserService);
  protected readonly displayName = this.userService.displayName;
  protected readonly avatar = computed(() => this.userService.currentUser()?.avatar ?? null);
  /** Read-only demo: a banner with a way out (every entry point stays, nothing is saved). */
  protected readonly isDemo = this.authService.isDemo;

  protected readonly webTabs = WEB_TABS;
  /** Mobile tab bar: two tabs on each side of the central "+" button (Sync lives in the avatar menu). */
  protected readonly mobileTabsLeft = WEB_TABS.slice(0, 2);
  protected readonly mobileTabsRight = WEB_TABS.slice(2, 4);

  /** Current URL, for the active tab (a tab can group several top-level pages). */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );
  protected readonly activeTab = computed(() => WEB_TABS.find((tab) => isTabActive(tab, this.url()))?.path ?? null);

  protected readonly shortcutLabel = /Mac|iPhone|iPad/i.test(globalThis.navigator?.userAgent ?? '')
    ? '⌘K'
    : 'Ctrl K';

  protected readonly searchOpen = signal(false);
  protected readonly menuOpen = signal(false);
  protected readonly addOpen = signal(false);
  protected readonly addItems: { kind: AddKind; labelKey: string; icon: LucideIconInput }[] = [
    { kind: 'diary', labelKey: 'nav.addDiary', icon: ICONS.notebookPen },
    { kind: 'run', labelKey: 'nav.addRun', icon: ICONS.play },
    { kind: 'game', labelKey: 'nav.addGame', icon: ICONS.gamepad2 },
    { kind: 'saga', labelKey: 'nav.addSaga', icon: ICONS.layers },
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

  protected add(kind: AddKind): void {
    this.addOpen.set(false);
    if (kind === 'run') {
      this.newRun();
    } else if (kind === 'diary') {
      // Today's diary day; the page opens its editor from the query param.
      void this.router.navigate(['/diary'], { queryParams: { date: todayIso() } });
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

  /** Leaves the demo session, landing on register ("Crear cuenta") or login ("Salir"). */
  protected exitDemo(target: '/register' | '/login'): void {
    this.authService.logout();
    this.router.navigate([target]);
  }
}
