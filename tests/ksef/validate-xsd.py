from pathlib import Path
import sys
from lxml import etree
root=Path(__file__).resolve().parents[1]/'fixtures'/'ksef'/'fa3'
class LocalResolver(etree.Resolver):
    def resolve(self,url,pubid,context):
        path=root/url.rsplit('/',1)[-1]
        if path.exists(): return self.resolve_filename(str(path),context)
        raise ValueError('Unexpected external schema dependency: '+url)
parser=etree.XMLParser(no_network=True)
parser.resolvers.add(LocalResolver())
schema=etree.XMLSchema(etree.parse(str(root/'schemat.xsd'),parser))
for file in sorted(Path(sys.argv[1]).glob('*.xml')):
    schema.assertValid(etree.parse(str(file)))
    print('PASS FA(3) XSD:',file.name)
