import { describe, expect, it, vi } from 'vitest';
import { idExtractionHandler, IdExtractionError } from './handler';

const userId = 'b1180000-0000-4000-8000-000000000001';
const frontPath = `${userId}/versions/c1180000-0000-4000-8000-000000000001/id-front.jpg`;
function fixture() {
  const deps = {
    caller: vi.fn(async () => userId), consume: vi.fn(async () => true),
    image: vi.fn(async () => new Uint8Array([1, 2, 3])),
    recognize: vi.fn(async () => 'Full Name: Ana Reyes\nID Number: 12345\nDate of Birth: 2000/02/29\nAddress: 12 Main St'),
  };
  const request = (body: unknown = { frontPath, idType: 'PhilSys' }, authorization = 'Bearer resident-token') => new Request('http://localhost/extract', { method: 'POST', headers: { Authorization: authorization }, body: JSON.stringify(body) });
  return { deps, handler: idExtractionHandler(deps), request };
}

describe('authenticated ID extraction endpoint', () => {
  it('returns editable extracted fields and omits raw recognized text', async () => {
    const { deps, handler, request } = fixture();
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ details: { fullName: 'Ana Reyes', idNumber: '12345', birthDate: '2000-02-29', address: '12 Main St' } });
    expect(deps.image).toHaveBeenCalledWith('Bearer resident-token', frontPath);
  });
  it.each(['', 'Basic secret'])('rejects invalid authentication %s before OCR', async token => {
    const { deps, handler, request } = fixture();
    expect((await handler(request(undefined, token))).status).toBe(401);
    expect(deps.recognize).not.toHaveBeenCalled();
  });
  it.each([
    frontPath.replace(userId, 'b1180000-0000-4000-8000-000000000002'), frontPath.replace('id-front', 'id-back'),
    `${userId}/versions/../id-front.jpg`, 'https://example.test/private-id.jpg',
  ])('rejects foreign, back, or arbitrary paths', async path => {
    const { deps, handler, request } = fixture();
    expect((await handler(request({ frontPath: path, idType: 'PhilSys' }))).status).toBe(403);
    expect(deps.image).not.toHaveBeenCalled(); expect(deps.recognize).not.toHaveBeenCalled();
  });
  it('stops paid OCR when rate limited', async () => {
    const { deps, handler, request } = fixture(); deps.consume.mockResolvedValue(false);
    expect((await handler(request())).status).toBe(429); expect(deps.recognize).not.toHaveBeenCalled();
  });
  it('rejects oversized images before OCR', async () => {
    const { deps, handler, request } = fixture(); deps.image.mockResolvedValue(new Uint8Array(5242881));
    expect((await handler(request())).status).toBe(400); expect(deps.recognize).not.toHaveBeenCalled();
  });
  it('reports unreadable photos and provider configuration failures for manual entry', async () => {
    const { deps, handler, request } = fixture(); deps.recognize.mockResolvedValue('');
    expect((await handler(request())).status).toBe(422);
    deps.recognize.mockRejectedValue(new IdExtractionError(503, 'Automatic reading is unavailable.'));
    expect((await handler(request())).status).toBe(503);
  });
});
