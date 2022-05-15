import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Install',
    Svg: require('@site/static/img/landing-install-icon.svg').default,
    link: "docs/cli/swa", 
    description: (
      <>
        Install the Azure Static Web Apps CLI  
        <br/>using <b>yarn</b> or <b>npm</b>. 
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
    title: 'Configure',
    Svg: require('@site/static/img/landing-configure-icon.svg').default,
    link: "docs/cli/env-vars", 
    description: (
      <>
        Setup <b>environment variables</b> 
        <br/>and <b>config settings</b>.
      </>
    ),
  },
  {
    title: 'Login',
    Svg: require('@site/static/img/landing-login-icon.svg').default,
    link: "docs/cli/swa-login", 
    description: (
      <>
        Authenticate with Azure services 
        <br/> using <b>swa login </b>
        <br/>  
      </>
    ),
  },
  {
    title: 'Init',
    Svg: require('@site/static/img/landing-init-icon.svg').default,
    link: "docs/cli/swa-init", 
    description: (
      <>
        Scaffold your static web app
        <br/>using <b>swa init</b>
      </>
    ),
  },
  {
    title: 'Start',
    Svg: require('@site/static/img/landing-start-icon.svg').default,
    link: "docs/cli/swa-start", 
    description: (
      <>
        Preview and debug your static web app
        <br/> using <b>swa start</b>.
      </>
    ),
  },
  {
    title: 'Deploy SWA (cloud)',
    Svg: require('@site/static/img/landing-deploy-icon.svg').default,
    link: "docs/cli/swa-deploy", 
    description: (
      <>
        Build/deploy to multiple environments  
        <br/> using <b>swa deploy</b>
      </>
    ),
  },
];

function Feature({Svg, title, description, link}) {
  return (
    <div className={clsx('col col--4')}>
        <div className="text--center">
          <a href={link} target="_blank">
            <Svg className={styles.featureSvg} role="img" />
          </a>
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
