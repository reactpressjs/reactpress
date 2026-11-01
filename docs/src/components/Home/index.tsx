import CallToAction from '@site/src/components/Home/CallToAction';
import Ecosystem from '@site/src/components/Home/Ecosystem';
import Hero from '@site/src/components/Home/Hero';
import Highlights from '@site/src/components/Home/Highlights';
import Platform from '@site/src/components/Home/Platform';
import QuickStart from '@site/src/components/Home/QuickStart';
import React from 'react';

export default function Home() {
  return (
    <>
      <Hero />
      <QuickStart />
      <Highlights />
      <Platform />
      <Ecosystem />
      <CallToAction />
    </>
  );
}
