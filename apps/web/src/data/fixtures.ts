import manifest from '@log-analyzer/core/fixtures/manifest.json';
import signal1Text from '@log-analyzer/core/fixtures/api_signal1.log?raw';
import signal2Text from '@log-analyzer/core/fixtures/api_signal2.log?raw';
import signal3Text from '@log-analyzer/core/fixtures/api_signal3.log?raw';

export interface BundledFixture {
  id: string;
  buttonLabel: string;
  file: string;
  description: string;
  sourceUrl: string;
  sha256: string;
}

export const bundledFixtures = manifest.fixtures satisfies BundledFixture[];

export function loadBundledFixtureText(id: string): string {
  switch (id) {
    case 'signal1':
      return signal1Text;
    case 'signal2':
      return signal2Text;
    case 'signal3':
      return signal3Text;
    default:
      throw new Error(`Unknown bundled fixture "${id}"`);
  }
}
