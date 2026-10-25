import { largeCoverUrl } from './cover-viewer';

describe('largeCoverUrl', () => {
  it('asks IGDB for its 1080p size whatever size was stored', () => {
    expect(largeCoverUrl('https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_1080p/co1abc.jpg',
    );
    expect(largeCoverUrl('//images.igdb.com/igdb/image/upload/t_thumb/co1abc.png')).toBe(
      '//images.igdb.com/igdb/image/upload/t_1080p/co1abc.png',
    );
  });

  it("takes Steam's 2x library capsule", () => {
    expect(
      largeCoverUrl('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/library_600x900.jpg?t=1'),
    ).toBe('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/library_600x900_2x.jpg?t=1');
  });

  it('leaves any other url as it is', () => {
    expect(largeCoverUrl('https://example.com/cover.png')).toBe('https://example.com/cover.png');
    expect(
      largeCoverUrl('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/library_600x900_2x.jpg'),
    ).toBe('https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/620/library_600x900_2x.jpg');
  });
});
