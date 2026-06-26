import { useEffect } from 'react'
import { useLocation } from "react-router-dom";
import { forEach, includes, capitalize } from 'lodash';
import { getSiteTitle } from '../../common/utils';

const SITE_TITLE = getSiteTitle()

/*eslint no-useless-escape: 0*/
const TITLES = {
  "/users/([a-zA-Z0-9\-\.\_\@]+)": `$1 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)": `$1 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/collections/([a-zA-Z0-9\-\.\_\@]+)": `$3 / $1 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/collections/([a-zA-Z0-9\-\.\_\@]+)": `$3 / $1 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/collections/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$4 / $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/collections/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)" : `$4 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)": `$3 / $1 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)": `$3 / $1 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $4 / $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $4 / $2- ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)": `$6 / $4 / $3 / $1 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)": `$5 / $3 / $1 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$6 / $4 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)": `$5 / $3 / $1 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$6 / $4 / $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$7 / $5 / $4 / $2 / $1 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $8 / $6 / $5 / $3 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$7 / $5 / $4 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $8 / $6 / $5 / $3 / $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $7 / $5 / $3 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/mappings/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $7 / $5 / $3 / $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)": `$6 / $4 / $3 / $1 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)":`$6 / $4 / $3 / $1 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)": `$6 / $4 / $3 / $1 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$6 / $4 / $3 / $1 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)": `$5 / $3 / $1 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$6 / $4 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)": `$5 / $3 / $1 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$6 / $4 / $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $8 / $6 / $5 / $3 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/:source([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$7 / $5 / $4 / $2 / $1 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/:source([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $8 / $6 / $5 / $3 / $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $7 / $5 / $3 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/concepts/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$1 - $7 / $5 / $3 / $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)": `$5 / $3 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/sources/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)":`$5 / $3 / $2 - ${SITE_TITLE}`,
  "/orgs/([a-zA-Z0-9\-\.\_\@]+)/collections/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)" : `$5 / $3 / $2 - ${SITE_TITLE}`,
  "/users/([a-zA-Z0-9\-\.\_\@]+)/collections/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)/([a-zA-Z0-9\-\.\_\@]+)" : `$5 / $3 / $2 - ${SITE_TITLE}`,
  "/([a-zA-Z0-9\-\.\_\@]+)/compare": `Compare - $2 - ${SITE_TITLE}`,
  "/imports": `Imports - ${SITE_TITLE}`,
  "/search": `Search - ${SITE_TITLE}`
}


export default function DocumentTitle() {
    const { pathname } = useLocation();
    const capitalWords = ['concepts', 'mappings', 'versions', 'details', 'history', 'sources', 'collections', 'orgs', 'references', 'about']
    useEffect(() => {
        forEach(TITLES, (title, routeName) => {
            if(new RegExp(routeName).test(pathname)) {
                const keywords = pathname.split("/").filter(ele => ele).reverse()
                keywords.forEach((keyword, index) => {
                    if(includes(capitalWords, keyword)) {
                        keyword = capitalize(keyword)
                    }
                    title = title.replace(`$${index+1}`, keyword)
                })
                document.title = title
            }
        })

        return () => document.title = SITE_TITLE
    }, [pathname]);

  return null;
  }
