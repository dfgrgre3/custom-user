import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListUsersQueryDto } from './list-users-query.dto';

/**
 * Regression test for a real bug: JS's `Boolean("false")` is `true`, so a
 * naive `@Type(() => Boolean)` on a query param would make
 * `?includeDeleted=false` behave like `?includeDeleted=true`. This exercises
 * the exact pipeline Nest's ValidationPipe uses (plainToInstance + validate)
 * against raw query-string values (always strings, as Express provides them).
 */
describe('ListUsersQueryDto — includeDeleted transform', () => {
  async function parse(rawValue: string | undefined) {
    const plain = rawValue === undefined ? {} : { includeDeleted: rawValue };
    const dto = plainToInstance(ListUsersQueryDto, plain);
    const errors = await validate(dto);
    return { dto, errors };
  }

  it('treats the string "false" as false', async () => {
    const { dto, errors } = await parse('false');
    expect(errors).toHaveLength(0);
    expect(dto.includeDeleted).toBe(false);
  });

  it('treats the string "true" as true', async () => {
    const { dto, errors } = await parse('true');
    expect(errors).toHaveLength(0);
    expect(dto.includeDeleted).toBe(true);
  });

  it('treats "False"/"TRUE" case-insensitively', async () => {
    expect((await parse('False')).dto.includeDeleted).toBe(false);
    expect((await parse('TRUE')).dto.includeDeleted).toBe(true);
  });

  it('defaults to false when the param is omitted', async () => {
    const { dto, errors } = await parse(undefined);
    expect(errors).toHaveLength(0);
    expect(dto.includeDeleted).toBe(false);
  });

  it('rejects a nonsense value instead of silently coercing it', async () => {
    const { errors } = await parse('yes');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('includeDeleted');
  });
});
