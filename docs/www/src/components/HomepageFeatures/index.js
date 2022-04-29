import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Install SWA CLI',
    Svg: require('@site/static/img/landing-install.svg').default,
    description: (
      <>
        Get started by installing the Azure Static Web Apps CLI using <b>yarn</b> or <b>npm</b>. 
        <br/>
        {/*
        <Link
          className="button button--secondary button--sm"
          to="https://docs.microsoft.com/en-us/azure/static-web-apps/getting-started?tabs=vanilla-javascript">
          Get Started With SWA
        </Link>
     */}
      </>
    ),
  },
  {
    title: 'Configure SWA CLI',
    Svg: require('@site/static/img/landing-configure.svg').default,
    description: (
      <>
        Explore the <b>environment variables</b> and <b>config settings</b> available for SWA CLI.
      </>
    ),
  },
  {
    title: 'Login to Azure',
    Svg: require('@site/static/img/landing-login.svg').default,
    description: (
      <>
        Use the <b>swa login</b> command to authenticate with the relevant services.
        <br/>  
      </>
    ),
  },
  {
    title: 'Initialize SWA',
    Svg: require('@site/static/img/landing-init.svg').default,
    description: (
      <>
        Use the <b>swa init</b> command to setup a project with a preferred web technology.
      </>
    ),
  },
  {
    title: 'Develop SWA (local)',
    Svg: require('@site/static/img/landing-start.svg').default,
    description: (
      <>
        Use the <b>swa start</b> command to preview and debug your SWA on a local server.
      </>
    ),
  },
  {
    title: 'Deploy SWA (cloud)',
    Svg: require('@site/static/img/landing-deploy.svg').default,
    description: (
      <>
        Use the <b>swa deploy</b> command to build and deploy SWA to multiple environments.
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
