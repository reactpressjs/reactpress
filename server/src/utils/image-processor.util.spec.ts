function loadImageProcessor(sharpImpl: jest.Mock) {
  jest.resetModules();
  jest.doMock('sharp', () => sharpImpl);
  return require('./image-processor.util') as typeof import('./image-processor.util');
}

function createSharpMock() {
  const mockToBuffer = jest.fn().mockResolvedValue({
    data: Buffer.from('webp'),
    info: { width: 320, height: 180, size: 42 },
  });
  const mockWebp = jest.fn(() => ({ toBuffer: mockToBuffer }));
  const mockResize = jest.fn(() => ({ webp: mockWebp, resize: mockResize }));
  const mockRotate = jest.fn(() => ({ resize: mockResize, webp: mockWebp, toBuffer: mockToBuffer }));
  const mockSharp = jest.fn(() => ({ rotate: mockRotate }));
  return { mockToBuffer, mockWebp, mockResize, mockRotate, mockSharp };
}

describe('image-processor helpers', () => {
  it('detects processable mimetypes', () => {
    const { mockSharp } = createSharpMock();
    const { isProcessableImage } = loadImageProcessor(mockSharp);
    expect(isProcessableImage('image/jpeg')).toBe(true);
    expect(isProcessableImage('IMAGE/PNG')).toBe(true);
    expect(isProcessableImage('image/gif')).toBe(true);
    expect(isProcessableImage('application/pdf')).toBe(false);
    expect(isProcessableImage('')).toBe(false);
  });

  it('returns variants per scene', () => {
    const { mockSharp } = createSharpMock();
    const { variantsForScene } = loadImageProcessor(mockSharp);
    expect(variantsForScene('avatar')).toEqual(['avatar']);
    expect(variantsForScene('content')).toEqual(['large', 'medium', 'thumb']);
    expect(variantsForScene('cover')).toEqual(['large', 'medium', 'thumb']);
    expect(variantsForScene('default')).toEqual(['large', 'medium', 'thumb']);
  });

  it('returns primary variant per scene', () => {
    const { mockSharp } = createSharpMock();
    const { primaryVariantForScene } = loadImageProcessor(mockSharp);
    expect(primaryVariantForScene('avatar')).toBe('avatar');
    expect(primaryVariantForScene('content')).toBe('medium');
    expect(primaryVariantForScene('cover')).toBe('large');
    expect(primaryVariantForScene('default')).toBe('large');
  });

  it('builds variant filenames and strips existing suffixes', () => {
    const { mockSharp } = createSharpMock();
    const { buildVariantFilename, listVariantFilenames } = loadImageProcessor(mockSharp);
    expect(buildVariantFilename('dir/photo_medium.webp', 'large')).toMatch(/photo\.webp$/);
    expect(buildVariantFilename('dir/photo.webp', 'thumb')).toMatch(/photo_thumb\.webp$/);
    expect(buildVariantFilename('avatar.png', 'avatar')).toMatch(/avatar_avatar\.webp$/);
    expect(listVariantFilenames('x/a.jpg')).toHaveLength(4);
  });

  it('processes inside fit variants', async () => {
    const sharpMocks = createSharpMock();
    const { processImageBuffer } = loadImageProcessor(sharpMocks.mockSharp);
    const result = await processImageBuffer(Buffer.from('raw'), 'medium');
    expect(sharpMocks.mockSharp).toHaveBeenCalledWith(Buffer.from('raw'), { animated: false });
    expect(sharpMocks.mockResize).toHaveBeenCalledWith(1200, undefined, expect.objectContaining({ fit: 'inside' }));
    expect(result.size).toBe(42);
  });

  it('processes cover fit for avatar', async () => {
    const sharpMocks = createSharpMock();
    const { processImageBuffer } = loadImageProcessor(sharpMocks.mockSharp);
    await processImageBuffer(Buffer.from('raw'), 'avatar');
    expect(sharpMocks.mockResize).toHaveBeenCalledWith(256, 256, expect.objectContaining({ fit: 'cover' }));
  });

  it('processes multiple variants', async () => {
    const sharpMocks = createSharpMock();
    const { processImageVariants } = loadImageProcessor(sharpMocks.mockSharp);
    const map = await processImageVariants(Buffer.from('raw'), ['thumb', 'large']);
    expect(map.get('thumb')?.width).toBe(320);
    expect(map.get('large')?.buffer).toEqual(Buffer.from('webp'));
  });
});
