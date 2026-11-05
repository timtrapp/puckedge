/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Analytics } from '@vercel/analytics/react';

export default function App() {
  return (
    <div id="puckedge-analytics-root" style={{ display: 'none' }} aria-hidden="true">
      {/* Vercel Web Analytics Root Component */}
      <Analytics />
    </div>
  );
}
