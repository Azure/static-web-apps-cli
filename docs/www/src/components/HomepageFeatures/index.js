import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Azure Static Web Apps',
    Svg: require('@site/static/img/read-docs.svg').default,
    description: (
      <>
        Azure Static Web Apps is a service that automatically builds and deploys full stack web apps to Azure from a code repository. 
        <br/>
        <Link
          className="button button--secondary button--sm"
          to="https://docs.microsoft.com/en-us/azure/static-web-apps/getting-started?tabs=vanilla-javascript">
          Get Started With SWA
        </Link>
      </>
    ),
  },
  {
    title: 'Static Web Apps CLI',
    Svg: require('@site/static/img/install-cli.svg').default,
    description: (
      <>
        The Static Web Apps CLI supports local development needs. Initialize, validate, and deploy your SWA from the commandline.
        <br/>  
        <Link
          className="button button--secondary button--sm"
          to="/docs/intro">
          Install the SWA CLI
        </Link>
      </>
    ),
  },
  {
    title: 'Recent News & Activity',
    Svg: require('@site/static/img/whats-new.svg').default,
    description: (
      <>
        The Static Web Apps CLI is at <i>pre-release v0.8.3</i>. Learn what's new and get an sneak peek at upcoming features. 
        <br/>
        <Link
          className="button button--secondary button--sm"
          to="/blog">
          Visit Our Dev Blog
        </Link>
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
