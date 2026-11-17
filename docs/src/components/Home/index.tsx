import CallToAction from '@site/src/components/Home/CallToAction';
import CursorAura from '@site/src/components/Home/CursorAura';
import Ecosystem from '@site/src/components/Home/Ecosystem';
import Hero from '@site/src/components/Home/Hero';
import Highlights from '@site/src/components/Home/Highlights';
import Platform from '@site/src/components/Home/Platform';
import Proof from '@site/src/components/Home/Proof';
import QuickStart from '@site/src/components/Home/QuickStart';
import ScrollRail from '@site/src/components/Home/ScrollRail';
import Showcase from '@site/src/components/Home/Showcase';
import React from 'react';

export default function Home() {
  return (
    <>
      <CursorAura />
      <ScrollRail />
      <Hero />
      <Platform />
      <Highlights />
      <QuickStart />
      <Proof />
      <Showcase />
      <Ecosystem />
      <CallToAction />
    </>
  );
}
